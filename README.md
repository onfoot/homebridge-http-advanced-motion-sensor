# homebridge-http-advanced-motion-sensor

This plugin offers you a motion sensor that can be triggerd via an HTTP request. This can be used in conjunction with an ESP8266 for instance or an Arduino with an ethernet shield.

It is based on the [homebridge-http-motion-sensor](https://github.com/lucavb/homebridge-http-motion-sensor) with the addition of supporing `fault` and `tamper` states that the HomeKit motion sensor accessory supports. Also, the sensor needs to check in every 90 seconds in order to have a semi-reliable motion sensor system.

This fork also removes the repeater function of the original.

A code refactor is slightly overdue. I plan to remake it in line with the rest of my recent plugins.

## Installation

`npm install -g homebridge-http-advanced-motion-sensor`

## Config.json

This is an example configuration

```
{
    "accessory": "http-advanced-motion-sensor",
    "name": "Hallway Motion Sensor",
    "port": 18089,
    "serial" : "E642011E3ECB"
}
```

| Key           | Description                                                                        |
|---------------|------------------------------------------------------------------------------------|
| accessory     | Required. Has to be "http-motion-sensor"                                             |
| name          | Required. The name of this accessory. This will appear in your homekit app         |
| port         | Required. The port that you want this plugin to listen on. Choose a number above 1024. |
| serial         | Optional. Assigns a serial number. Not really required but I would advise in making up some arbitrary string. |

## Device state reporting

In order to receive all the proper states of the motion sensor, the device needs to call the endpoints exposed by the plugin.

- `/motion` to report that motion sensor triggered
- `/tamper` in case of tampering
- `/ping` for check-ins in 90-second intervals. If the device fails to check in in that period, a `Fault` state will be set for the sensor on HomeKt side
