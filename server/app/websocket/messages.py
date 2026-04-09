"""
Message type definitions for the WebSocket protocol between server and client.

All messages are JSON objects with a `type` field.

Client -> Server messages:
  - telemetry: periodic system metrics
  - software_inventory: list of installed software
  - event_report: system event/crash report
  - ntp_status: NTP sync status
  - network_info: network interface info
  - ssh_keys: authorized SSH key inventory
  - process_list: latest top process snapshot
  - command_output: streaming output from a running command
  - command_result: final result of a command execution
  - screenshot_result: screenshot capture result

Server -> Client messages:
  - command: execute a command on the device
  - config_update: update agent configuration
  - screenshot_request: capture screenshot
  - ping: keep-alive ping
"""

from enum import StrEnum


class ClientMessageType(StrEnum):
    TELEMETRY = "telemetry"
    SOFTWARE_INVENTORY = "software_inventory"
    EVENT_REPORT = "event_report"
    NTP_STATUS = "ntp_status"
    NETWORK_INFO = "network_info"
    SSH_KEYS = "ssh_keys"
    PROCESS_LIST = "process_list"
    COMMAND_OUTPUT = "command_output"
    COMMAND_RESULT = "command_result"
    SCREENSHOT_RESULT = "screenshot_result"


class ServerMessageType(StrEnum):
    COMMAND = "command"
    CONFIG_UPDATE = "config_update"
    SCREENSHOT_REQUEST = "screenshot_request"
    PING = "ping"
    ACK = "ack"
