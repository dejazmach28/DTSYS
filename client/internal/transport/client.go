package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// CommandHandler is called when the server sends a command.
type CommandHandler func(cmd IncomingCommand)
type ConfigUpdateHandler func(update ConfigUpdateData)
type ScreenshotRequestData struct {
	CommandID string `json:"command_id"`
}

// Client manages the persistent WebSocket connection to the DTSYS server.
type Client struct {
	serverURL string
	deviceID  string
	apiKey    string
	onCommand CommandHandler
	onConfig  ConfigUpdateHandler

	conn   *websocket.Conn
	mu     sync.Mutex
	closed bool

	sendCh chan Message
}

func NewClient(serverURL, deviceID, apiKey string, onCommand CommandHandler, onConfig ConfigUpdateHandler) *Client {
	return &Client{
		serverURL: serverURL,
		deviceID:  deviceID,
		apiKey:    apiKey,
		onCommand: onCommand,
		onConfig:  onConfig,
		sendCh:    make(chan Message, 64),
	}
}

// Run connects and maintains the connection until ctx is cancelled.
func (c *Client) Run(ctx context.Context) {
	backoff := newBackoff(5*time.Second, 5*time.Minute)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		if err := c.connect(ctx); err != nil {
			slog.Error("websocket connect failed", "error", err)
			wait := backoff.next()
			slog.Info("reconnecting", "in", wait)
			select {
			case <-ctx.Done():
				return
			case <-time.After(wait):
			}
			continue
		}

		backoff.reset()
		c.readLoop(ctx)

		if ctx.Err() != nil {
			return
		}
	}
}

func (c *Client) connect(ctx context.Context) error {
	wsURL, err := buildWSURL(c.serverURL, c.deviceID, c.apiKey)
	if err != nil {
		return err
	}

	dialer := websocket.Dialer{HandshakeTimeout: 10 * time.Second}
	conn, _, err := dialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return fmt.Errorf("dial %s: %w", wsURL, err)
	}

	c.mu.Lock()
	c.conn = conn
	c.mu.Unlock()

	slog.Info("connected to server", "url", wsURL)

	// Start write pump
	go c.writePump()

	return nil
}

func (c *Client) readLoop(ctx context.Context) {
	defer func() {
		c.mu.Lock()
		if c.conn != nil {
			c.conn.Close()
			c.conn = nil
		}
		c.mu.Unlock()
	}()

	for {
		var raw map[string]json.RawMessage
		err := c.conn.ReadJSON(&raw)
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				slog.Warn("websocket read error", "error", err)
			}
			return
		}

		var msgType string
		if t, ok := raw["type"]; ok {
			if err := json.Unmarshal(t, &msgType); err != nil {
				continue
			}
		}

		switch msgType {
		case MsgTypeCommand:
			var cmd IncomingCommand
			if data, ok := raw["data"]; ok {
				if err := json.Unmarshal(data, &cmd); err == nil && c.onCommand != nil {
					go c.onCommand(cmd)
				}
			}
		case MsgTypeScreenshotRequest:
			var req ScreenshotRequestData
			if data, ok := raw["data"]; ok {
				if err := json.Unmarshal(data, &req); err == nil && c.onCommand != nil {
					go c.onCommand(IncomingCommand{
						CommandID:   req.CommandID,
						CommandType: "screenshot",
						Payload:     map[string]interface{}{},
					})
				}
			}
		case MsgTypeConfigUpdate:
			var update ConfigUpdateData
			if data, ok := raw["data"]; ok {
				if err := json.Unmarshal(data, &update); err == nil && c.onConfig != nil {
					go c.onConfig(update)
				}
			}
		case MsgTypePing:
			c.Send(Message{Type: "pong"})
		case MsgTypeAck:
			// Server acknowledged our message
		}
	}
}

func (c *Client) writePump() {
	for msg := range c.sendCh {
		c.mu.Lock()
		conn := c.conn
		c.mu.Unlock()
		if conn == nil {
			break
		}
		if err := conn.WriteJSON(msg); err != nil {
			slog.Warn("write error", "error", err)
			break
		}
	}
}

// Send queues a message for sending. Non-blocking; drops if buffer full.
func (c *Client) Send(msg Message) {
	select {
	case c.sendCh <- msg:
	default:
		slog.Warn("send buffer full, dropping message", "type", msg.Type)
	}
}

func (c *Client) SendTelemetry(data TelemetryData) {
	c.Send(Message{Type: MsgTypeTelemetry, Data: data})
}

func (c *Client) SendSoftwareInventory(packages []SoftwarePackage) {
	c.Send(Message{Type: MsgTypeSoftwareInventory, Data: SoftwareInventoryData{Packages: packages}})
}

func (c *Client) SendEvent(data EventData) {
	c.Send(Message{Type: MsgTypeEventReport, Data: data})
}

func (c *Client) SendNTPStatus(data NTPStatusData) {
	c.Send(Message{Type: MsgTypeNTPStatus, Data: data})
}

func (c *Client) SendCommandResult(data CommandResultData) {
	c.Send(Message{Type: MsgTypeCommandResult, Data: data})
}

func (c *Client) SendScreenshotResult(data ScreenshotResultData) {
	c.Send(Message{Type: MsgTypeScreenshotResult, Data: data})
}

func (c *Client) SendProcessList(processes []ProcessInfo) {
	c.Send(Message{Type: MsgTypeProcessList, Data: ProcessListData{Processes: processes}})
}

func buildWSURL(serverURL, deviceID, apiKey string) (string, error) {
	u, err := url.Parse(serverURL)
	if err != nil {
		return "", err
	}
	// Convert http(s) to ws(s)
	switch u.Scheme {
	case "http":
		u.Scheme = "ws"
	case "https":
		u.Scheme = "wss"
	}
	u.Path = fmt.Sprintf("/ws/device/%s", deviceID)
	q := u.Query()
	q.Set("token", apiKey)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// backoff implements exponential backoff with cap
type backoff struct {
	current time.Duration
	initial time.Duration
	max     time.Duration
}

func newBackoff(initial, max time.Duration) *backoff {
	return &backoff{current: initial, initial: initial, max: max}
}

func (b *backoff) next() time.Duration {
	d := b.current
	b.current *= 2
	if b.current > b.max {
		b.current = b.max
	}
	return d
}

func (b *backoff) reset() {
	b.current = b.initial
}
