import assert from "node:assert/strict";
import test from "node:test";

import { buildAllowedDevOrigins } from "./next-dev-origins.mjs";

test("includes localhost and detected non-internal IPv4 addresses", () => {
  const origins = buildAllowedDevOrigins({
    networkInterfaces: {
      lo: [
        {
          address: "127.0.0.1",
          family: "IPv4",
          internal: true,
          netmask: "255.0.0.0",
          mac: "00:00:00:00:00:00",
          cidr: "127.0.0.1/8",
        },
      ],
      eth0: [
        {
          address: "192.168.31.150",
          family: "IPv4",
          internal: false,
          netmask: "255.255.255.0",
          mac: "00:11:22:33:44:55",
          cidr: "192.168.31.150/24",
        },
      ],
      tailscale0: [
        {
          address: "100.76.76.76",
          family: "IPv4",
          internal: false,
          netmask: "255.255.255.255",
          mac: "00:11:22:33:44:66",
          cidr: "100.76.76.76/32",
        },
      ],
      docker0: [
        {
          address: "172.17.0.1",
          family: "IPv4",
          internal: false,
          netmask: "255.255.0.0",
          mac: "00:11:22:33:44:77",
          cidr: "172.17.0.1/16",
        },
      ],
      wlan0: [
        {
          address: "fe80::1",
          family: "IPv6",
          internal: false,
          netmask: "ffff:ffff:ffff:ffff::",
          mac: "00:11:22:33:44:88",
          cidr: "fe80::1/64",
          scopeid: 0,
        },
      ],
    },
  });

  assert.deepEqual(origins, [
    "localhost",
    "127.0.0.1",
    "192.168.31.150",
    "100.76.76.76",
    "172.17.0.1",
  ]);
});

test("merges extra dev origins and strips scheme or port", () => {
  const origins = buildAllowedDevOrigins({
    networkInterfaces: {},
    extraOrigins:
      "http://demo.local:3000 https://preview.example.test foo.local:3001 100.100.100.100:4000",
  });

  assert.deepEqual(origins, [
    "localhost",
    "127.0.0.1",
    "demo.local",
    "preview.example.test",
    "foo.local",
    "100.100.100.100",
  ]);
});
