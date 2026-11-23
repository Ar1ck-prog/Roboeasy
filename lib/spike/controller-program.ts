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

tunnel = hub.config['module_tunnel']
ports = (port.A, port.B, port.C, port.D, port.E, port.F)
speeds = [0] * 6
last = 0

def apply(values):
    for i in range(6):
        speed = values[i]
        if speed != speeds[i]:
            if speed:
                motor.run(ports[i], speed * ${MAX_VELOCITY / 100}, acceleration=${ACCELERATION})
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

def receive(data):
    global last
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
    try:
        apply(values)
        last = time.ticks_ms()
        if mode == '${CONSOLE_COMMAND}':
            print('${CONTROLLER_CONSOLE_PREFIX}' + mode + chr(data[1]) + chr(data[2]))
        else:
            tunnel.send(data[:3])
    except Exception as error:
        brake()
        print('${CONTROLLER_CONSOLE_PREFIX}ERR', error)

def main():
    global last
    last = time.ticks_ms()
    tunnel.callback(receive)
    print('${CONTROLLER_CONSOLE_PREFIX}READY')
    try:
        while True:
            if time.ticks_diff(time.ticks_ms(), last) >= ${WATCHDOG_MS}:
                brake()
            time.sleep_ms(10)
    finally:
        brake()

main()
`
