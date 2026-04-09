"""
Message type definitions for the WebSocket protocol between server and client.

All messages are JSON objects with a `type` field.

Client -> Server messages:
  - telemetry: periodic system metrics
  - software_inventory: list of installed software
  - event_report: system event/crash report
  - ntp_status: NTP sync status
  - network_info: network interface info
  - command_output: streaming output from a running command
  - command_result: final result of a command execution

Server -> Client messages:
  - command: execute a command on the device
  - config_update: update agent configuration
  - ping: keep-alive ping
"""

from enum import StrEnum


class ClientMessageType(StrEnum):
    TELEMETRY = "telemetry"
    SOFTWARE_INVENTORY = "software_inventory"
    EVENT_REPORT = "event_report"
    NTP_STATUS = "ntp_status"
    NETWORK_INFO = "network_info"
    COMMAND_OUTPUT = "command_output"
    COMMAND_RESULT = "command_result"


class ServerMessageType(StrEnum):
    COMMAND = "command"
    CONFIG_UPDATE = "config_update"
    PING = "ping"
    ACK = "ack"
