"use strict"
const dgram = require("dgram"),
{ networkInterfaces } = require("os")
var tickCount = 1
const MCAST_GRP = "239.2.1.1",
  MCAST_PORT = 2054,
  MCAST_PUBLISH_PORT = 2053,
  navicoAlarmType = {
    normal: "",
    alert: "Light Warning",
    warn: "Warning",
    alarm: "Important",
    emergency: "Vital",
  },
  isDefinedOrDefault = (a, b) => ("undefined" == typeof a ? b : a),
  getIpAddress = () => {
    const a = networkInterfaces(),
      b = Object.create(null)
    for (const c of Object.keys(a))
      for (const d of a[c])
        "IPv4" !== d.family ||
          d.internal ||
          (b[c] || (b[c] = []), b[c].push(d.address))
    for (var c = ["eth0", "ll-eth0", "en7", "en0"], d = 0; d < c.length; d++) {
      const a = c[d]
      if (b[a]) return b[a][0]
    }
    return b[0][0]
  }
module.exports = function (a) {
  function b() {
    ;(f = {
      title: "SignalK",
      type: "object",
      properties: {
        enableMFDNotification: {
          title: "EnableMFDNotification",
          type: "boolean",
          default: !0,
          name: "EnableMFDNotification",
        },
        publishToMFD: {
          title: "Publish IHM to MFD",
          type: "boolean",
          default: !0,
        },
        publishSource: {
          title:
            "Source name for MFD (only change it is there are multiple Signal K server)",
          type: "string",
          default: "SignalK",
        },
        demoMode: {
          title: "Activate DEMONSTRATION mode",
          type: "boolean",
          default: !1,
        },
        paths: {
          type: "array",
          title: " ",
          default: defaultNotification,
          items: {
            title: "Notifications",
            type: "object",
            required: ["key"],
            properties: {
              enabled: { title: "Enabled", type: "boolean", default: !0 },
              key: { title: "SignalK Path", type: "string", default: "" },
              name: {
                title: "Name",
                description:
                  "If specified, this will be used in the message of the notification, otherwise the displayName or key will be used",
                type: "string",
              },
              highValue: {
                id: "highValue",
                type: "number",
                title: "High Value",
                description:
                  "If specified, the notification will be raised when th the value goes above this",
                name: "highValue",
              },
              highValueMessage: {
                id: "highValueMessage",
                type: "string",
                title: "High value Message",
                description:
                  "If specified, this message will be displayed for higher value",
                name: "highValueMessage",
              },
              lowValue: {
                id: "lowValue",
                type: "number",
                title: "Low Value",
                description:
                  "If specified, the notification will be raised when th the value goes below this",
                name: "lowValue",
              },
              lowValueMessage: {
                id: "lowValueMessage",
                type: "string",
                title: "Low Value Message",
                description:
                  "If specified, this message will be displayed for lower value",
                name: "lowValueMessage",
              },
              defaultMessage: {
                id: "defaultMessage",
                type: "string",
                title: "default Message",
                description:
                  "If high value message or low value message is not defined, this will be taken into action",
                name: "defaultMessage",
              },
              state: {
                type: "string",
                title: "Alarm State",
                description: "The alarm state when the value is in this zone.",
                default: "normal",
                enum: ["normal", "alert", "warn", "alarm", "emergency"],
              },
              visual: {
                title: "Visual",
                type: "boolean",
                description: "Display a visual indication of the notification",
                default: !0,
              },
              sound: {
                title: "Sound",
                type: "boolean",
                description: "Sound an audible indication of the notification",
                default: !0,
              },
              mfdAlarm: {
                title: "MFD Alarm",
                type: "boolean",
                description: "Raise an alarm on MFD",
                default: !0,
              },
            },
          },
        },
      },
    }),
      (g = {})
  }
  function c(b, c, e) {
    const {
      key: f,
      state: g,
      visual: h,
      sound: i,
      highValueMessage: j,
      lowValueMessage: l,
      defaultMessage: m,
      mfdAlarm: n,
    } = b
    let o = null
    0 === c
      ? (o = {
          state: "normal",
          timestamp: new Date().toISOString(),
          message: m,
          key: f,
        })
      : ((o = {
          state: g,
          method: [],
          timestamp: new Date().toISOString(),
          message: "",
          key: f,
        }),
        h && o.method.push("visual"),
        i && o.method.push("sound"),
        (o.message = -1 === c ? l : j))
    const p = {
      context: "vessels." + a.selfId,
      updates: [{ values: [{ path: "notifications." + f, value: o }] }],
    }
    a.debug("delta: " + JSON.stringify(p)),
      a.handleMessage(k.id, p),
      n && e && d(b, o.state)
  }
  function d(b, c) {
    const { key: d, name: e } = b
    var f = e
    "undefined" == typeof f &&
      ((f = a.getSelfPath(d + ".meta.displayName")), !f && (f = d))
    const g = getIpAddress()
    var i
    ;(tickCount += 1),
      (i = {
        Version: "1",
        Source: "SignalK",
        FeatureName: f,
        IP: g,
        TickCount: tickCount,
        Alarms: [],
      }),
      "normal" !== c &&
        (i.Alarms = [
          { Type: navicoAlarmType[c], NewTickCount: tickCount, Count: 1 },
        ]),
      h &&
        (a.debug("MFD NOTIFY: " + JSON.stringify(i)),
        (i = Buffer.from(JSON.stringify(i))),
        h.send(i, MCAST_PORT, MCAST_GRP, (b) => {
          b && a.error("MFD NOTIFY ERROR:" + b)
        }))
  }
  function e(a, b) {
    var c
    var d = getIpAddress(),
      e =
        null !==
          (c = a.config.settings.ssl
            ? a.config.settings.sslport
            : a.config.settings.port) && void 0 !== c
          ? c
          : 3e3
    try {
      var f = {
        Version: "1",
        Source: b.publishSource || "SignalK",
        FeatureName: "Marine Exchange",
        IP: d,
        Text: [
          {
            Language: "en",
            Name: b.publishSource || "SignalK",
            Description: "SignalK web plugin",
          },
        ],
        Image: `http://${d}:${e}/signalk-mfd-plugin/Logo-SignalK-navico.png`,
        URL: `http://${d}:${e}/signalk-mfd-plugin/`,
      }
      ;(f = Buffer.from(JSON.stringify(f))),
        h.send(f, MCAST_PUBLISH_PORT, MCAST_GRP, (b) => {
          a.debug("PUBLISH: sent " + f), b && a.error("SEND ERROR: " + b)
        })
    } catch (b) {
      a.error("PUBLISH ERROR: " + b), h.close()
    }
  }
  var f,
    g,
    h,
    i,
    j,
    k = {},
    l = []
  return (
    (k.id = "signalk-mfd-plugin"),
    (k.name = "Signalk MFD plugin"),
    (k.description = "Vanilla SignalK plugin for MFDs."),
    (k.schema = function () {
      return b(), f
    }),
    (k.uiSchema = function () {
      return b(), g
    }),
    (k.start = function (b) {
      a.debug("Start with options: " + JSON.stringify(b))
      try {
        a.debug("Creating socket"),
          (h = dgram.createSocket("udp4")),
          a.debug("Socket created")
        const c = getIpAddress()
        h.bind(MCAST_PUBLISH_PORT, c, () => {}),
          isDefinedOrDefault(b.publishToMFD, !0) &&
            (i = setInterval(() => e(a, b), 5e3))
      } catch (b) {
        a.error("Error creating BROADCAST socket: " + b)
      }
      return (
        (l = (isDefinedOrDefault(b.paths, defaultNotification) || []).reduce(
          (d, e) => {
            const { key: f, enabled: g, lowValue: h, highValue: i } = e
            if (g) {
              a.debug(`subscribing to ${f}`)
              var j = a.streambundle.getSelfStream(f)
              d.push(
                j
                  .map((a) =>
                    "undefined" != typeof h && a < h
                      ? -1
                      : "undefined" != typeof i && a > i
                      ? 1
                      : 0
                  )
                  .skipDuplicates()
                  .onValue((a) => {
                    c(e, a, isDefinedOrDefault(b.enableMFDNotification, !0))
                  })
              )
            }
            return d
          },
          []
        )),
        !0
      )
    }),
    (k.stop = function () {
      m.stop(),
        n.stop(),
        l.forEach((a) => a()),
        (l = []),
        h.close(),
        i && (clearInterval(i), (i = void 0)),
        j && (clearInterval(j), (j = void 0))
    }),
    k
  )
}
const defaultNotification = [
  {
    enabled: !0,
    key: "propulsion.port.controller.temperature",
    name: "Temp\xE9rature variateur babord",
    highValue: 327,
    highValueMessage: "Temp\xE9rature trop \xE9lev\xE9e",
    state: "warn",
    visual: !0,
    sound: !0,
    mfdAlarm: !0,
  },
  {
    enabled: !0,
    key: "propulsion.starboard.controller.temperature",
    name: "Temp\xE9rature variateur tribord",
    highValue: 327,
    highValueMessage: "Temp\xE9rature trop \xE9lev\xE9e",
    state: "warn",
    visual: !0,
    sound: !0,
    mfdAlarm: !0,
  },
  {
    enabled: !0,
    key: "electrical.batteries.0.capacity.stateOfCharge",
    name: "Batteries",
    lowValue: 0.15,
    lowValueMessage: "Batterie faible",
    state: "warn",
    visual: !0,
    sound: !0,
    mfdAlarm: !0,
  },
]
