export const WATCHDOG_MS = 350
export const MAX_VELOCITY = 500
export const CONTROLLER_COMMAND = 'M'

/** SPIKE App 3 Python. Each command replaces the complete state of the six ports. */
export const CONTROLLER_PROGRAM = `import hub
from hub import port
import motor
import time

tunnel = hub.config['module_tunnel']
ports = (port.A, port.B, port.C, port.D, port.E, port.F)
speeds = [0] * 6
pending = None

def receive(data):
    global pending
    if isinstance(data, str):
        data = data.encode()
    if len(data) != 15 or data[:1] != b'${CONTROLLER_COMMAND}':
        return
    try:
        values = [int(data[i:i+2], 16) - 100 for i in range(3, 15, 2)]
    except ValueError:
        return
    if all(-100 <= v <= 100 for v in values):
        pending = (data[:3], values, time.ticks_ms())

def apply(values):
    for i in range(6):
        speed = values[i]
        if speed != speeds[i]:
            if speed:
                motor.run(ports[i], speed * ${MAX_VELOCITY / 100})
            else:
                motor.stop(ports[i], stop=motor.BRAKE)
            speeds[i] = speed

def brake():
    for i in range(6):
        if speeds[i]:
            try:
                motor.stop(ports[i], stop=motor.BRAKE)
            except Exception:
                pass
            speeds[i] = 0

def main():
    global pending
    last = time.ticks_ms()
    tunnel.callback(receive)
    try:
        while True:
            now = time.ticks_ms()
            if time.ticks_diff(now, last) >= ${WATCHDOG_MS}:
                brake()
            command = pending
            if command is not None:
                pending = None
                reply, values, last = command
                if time.ticks_diff(now, last) < ${WATCHDOG_MS}:
                    apply(values)
                    tunnel.send(reply)
            time.sleep_ms(10)
    finally:
        brake()

main()
`
