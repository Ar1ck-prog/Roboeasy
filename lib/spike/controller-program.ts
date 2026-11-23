export const WATCHDOG_MS = 350
export const MAX_VELOCITY = 500
const ACCELERATION = 3500
export const CONTROLLER_COMMAND = 'M'
export const CONSOLE_COMMAND = 'K'
export const CONTROLLER_CONSOLE_PREFIX = 'RBE:'

/** SPIKE App 3 Python. Each command replaces the complete state of the six ports. */
export const CONTROLLER_PROGRAM = `import hub
from hub import port
import motor
import time
try:
    import device
except ImportError:
    device = None

tunnel = hub.config['module_tunnel']
ports = (port.A, port.B, port.C, port.D, port.E, port.F)
speeds = [0] * 6
last = 0
pending = None
use_acceleration = True

def motor_present(p):
    try:
        if device is not None and hasattr(device, 'id'):
            return device.id(p) in (48, 49, 65) and (not hasattr(device, 'ready') or device.ready(p))
        motor.relative_position(p)
        return True
    except (OSError, RuntimeError, ValueError, AttributeError, TypeError):
        return False

def motor_fault(prefix, index, error):
    brake()
    print('${CONTROLLER_CONSOLE_PREFIX}ERR ' + prefix.decode() + ' ' + 'ABCDEF'[index] + ' ' + str(error) + '|')
    return False

def run_motor(p, velocity):
    global use_acceleration
    if use_acceleration:
        try:
            motor.run(p, velocity, acceleration=${ACCELERATION})
            return
        except TypeError:
            use_acceleration = False
    motor.run(p, velocity)

def apply(prefix, values):
    # Verify each newly commanded motor before changing any output.
    for i in range(6):
        if values[i] and values[i] != speeds[i] and not motor_present(ports[i]):
            return motor_fault(prefix, i, 'ENODEV')
    for i in range(6):
        speed = values[i]
        if speed != speeds[i]:
            try:
                if speed:
                    run_motor(ports[i], speed * ${MAX_VELOCITY / 100})
                else:
                    motor.stop(ports[i])
                speeds[i] = speed
            except Exception as error:
                return motor_fault(prefix, i, error)
    return True

def brake():
    for i in range(6):
        if speeds[i]:
            try:
                motor.stop(ports[i])
            except Exception:
                pass
            speeds[i] = 0

def acknowledge(prefix):
    if chr(prefix[0]) == '${CONSOLE_COMMAND}':
        print('${CONTROLLER_CONSOLE_PREFIX}' + prefix.decode())
    else:
        try:
            tunnel.send(prefix)
        except Exception:
            # A failed notification does not undo a successfully applied command.
            pass

def receive(data):
    global last, pending
    if isinstance(data, str):
        data = data.encode()
    if len(data) != 15:
        return
    mode = chr(data[0])
    if mode != '${CONTROLLER_COMMAND}' and mode != '${CONSOLE_COMMAND}':
        return
    values = []
    digits = '0123456789abcdef'
    for i in range(3, 15, 2):
        high = digits.find(chr(data[i]))
        low = digits.find(chr(data[i+1]))
        speed = high * 16 + low - 100
        if high < 0 or low < 0 or speed < -100 or speed > 100:
            return
        values.append(speed)
    prefix = bytes(data[:3])
    if pending is None and not any(speeds) and not any(values):
        # Respond to the browser's neutral startup probe from the callback.
        last = time.ticks_ms()
        acknowledge(prefix)
    else:
        pending = (prefix, values, time.ticks_ms())

def main():
    global last, pending
    last = time.ticks_ms()
    next_scan = None
    previous = None
    tunnel.callback(receive)
    print('${CONTROLLER_CONSOLE_PREFIX}READY')
    try:
        while True:
            now = time.ticks_ms()
            if time.ticks_diff(now, last) >= ${WATCHDOG_MS}:
                brake()
            command = pending
            if command is not None:
                pending = None
                prefix, values, received_at = command
                if time.ticks_diff(now, received_at) < ${WATCHDOG_MS}:
                    last = received_at
                    if apply(prefix, values):
                        acknowledge(prefix)
            if next_scan is None or time.ticks_diff(now, next_scan) >= 0:
                snapshot = ''.join('ABCDEF'[i] for i in range(6) if motor_present(ports[i]))
                if any(speeds[i] and 'ABCDEF'[i] not in snapshot for i in range(6)):
                    brake()
                if snapshot != previous:
                    print('${CONTROLLER_CONSOLE_PREFIX}PORTS ' + snapshot + '|')
                    previous = snapshot
                next_scan = time.ticks_add(now, 500)
            time.sleep_ms(10)
    finally:
        brake()

main()
`
