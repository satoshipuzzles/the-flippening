#!/usr/bin/env python3
"""Post the chain tips this machine can see to the sites' chain tip relay.

The XBT chain has one public block explorer, mempool.guide. On 2026-10-15 it
stopped answering on 443 - the host still pinged, so nothing looked broken -
and because the API waited on it, the price feeds on the-flippening and
ask-your-custodian both went down with it even though NeoxEX and Coinbase were
healthy the whole time. This is the second source: our own Knots node, which is
the thing the dashboards already treat as the authority on the XBT chain.

One-way. It posts five numbers and reads nothing back. The push key lives in
~/.config/flippening/push.key (0600), never in this file.

Run by launchd every minute (com.flippening.chaintip-push).
"""
import base64, json, os, sys, time, urllib.error, urllib.request

CONF = os.path.expanduser("~/Library/Application Support/Bitcoin/bitcoin.conf")
KEYFILE = os.path.expanduser("~/.config/flippening/push.key")
TARGETS = [
    "https://the-flippening.vercel.app/api/chaintip",
    "https://ask-your-custodian.vercel.app/api/chaintip",
]
WINDOW = 1008  # blocks to average the interval over, about a week on XBT


def rpc(method, params=None):
    user = pw = None
    for line in open(CONF):
        line = line.strip()
        if line.startswith("rpcuser="):
            user = line.split("=", 1)[1]
        elif line.startswith("rpcpassword="):
            pw = line.split("=", 1)[1]
    if not user:
        raise SystemExit("no rpcuser in bitcoin.conf")
    body = json.dumps({"jsonrpc": "1.0", "id": "chaintip",
                       "method": method, "params": params or []}).encode()
    req = urllib.request.Request("http://127.0.0.1:8332/", data=body)
    req.add_header("Authorization",
                   "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode())
    req.add_header("Content-Type", "text/plain")
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)["result"]


def header_time(height):
    return rpc("getblockheader", [rpc("getblockhash", [height])])["time"]


def xbt_tip():
    h = rpc("getblockcount")
    info = rpc("getblockchaininfo")
    if info.get("initialblockdownload"):
        raise SystemExit("node is still syncing, not publishing a tip")
    now, then = header_time(h), header_time(h - WINDOW)
    return {"chain": "xbt", "height": h, "tipTime": now,
            "blockInterval": (now - then) / WINDOW}


def shat_tip():
    """mempool.space is healthy, but a backstop that only exists while the
    thing it backs up is also healthy is not a backstop."""
    o = urllib.request.urlopen("https://mempool.space/api/blocks/tip/height", timeout=10)
    h = int(o.read().decode().strip())
    blocks = json.load(urllib.request.urlopen(
        f"https://mempool.space/api/v1/blocks/{h}", timeout=10))
    ts = [b["timestamp"] for b in blocks]
    return {"chain": "btc", "height": h, "tipTime": ts[0],
            "blockInterval": (ts[0] - ts[-1]) / (len(ts) - 1) if len(ts) > 1 else None}


# ---- watchdog ----------------------------------------------------------------
# Kenny found the 2026-10-15 outage himself, by looking at the sites. A price
# feed that is down is actionable signal, so it should arrive as a push the way
# mining alerts do - and nothing else should, or the alerts stop being read.
# One notification when it has been down five minutes running, one when it is
# back, nothing in between.
HEALTH = {
    "the flippening": "https://the-flippening.vercel.app/api/data",
    "ask your custodian": "https://ask-your-custodian.vercel.app/api/quote",
}
STATE = os.path.expanduser("~/.config/flippening/health.json")
NOTIFY = os.path.expanduser("~/.config/xbt-dashboard/notify.json")
DOWN_AFTER = 5  # consecutive failed minutes


def notify(title, body, priority="default"):
    try:
        c = json.load(open(NOTIFY))
        if not c.get("enabled") or not c.get("topic"):
            return
        req = urllib.request.Request(
            f"{c.get('server', 'https://ntfy.sh')}/{c['topic']}",
            data=body.encode(), method="POST")
        req.add_header("Title", title)
        req.add_header("Priority", priority)
        req.add_header("Tags", "chart_with_downwards_trend")
        urllib.request.urlopen(req, timeout=15).read()
    except Exception as e:
        print(f"{time.strftime('%F %T')} notify: {e}", file=sys.stderr)


def check_feeds():
    try:
        st = json.load(open(STATE))
    except Exception:
        st = {}
    for name, url in HEALTH.items():
        why = None
        try:
            with urllib.request.urlopen(url + "?health=1", timeout=20) as r:
                d = json.load(r)
            if "error" in d:
                why = d["error"]
            elif not (d.get("xbt") or {}).get("btc"):
                why = "no XBT price in the payload"
        except Exception as e:
            why = str(e)
        s = st.setdefault(name, {"fails": 0, "alerted": False})
        if why:
            s["fails"] += 1
            s["why"] = why
            if s["fails"] >= DOWN_AFTER and not s["alerted"]:
                s["alerted"] = True
                notify(f"{name}: price feed down",
                       f"Down {s['fails']} minutes. Last error: {why}", "high")
        else:
            if s["alerted"]:
                notify(f"{name}: price feed back",
                       f"Recovered after {s['fails']} minutes.")
            s["fails"], s["alerted"], s["why"] = 0, False, None
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    json.dump(st, open(STATE, "w"), indent=2)
    return st


def push(url, key, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 method="POST")
    req.add_header("content-type", "application/json")
    req.add_header("x-push-key", key)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status


def main():
    key = open(KEYFILE).read().strip()
    tips = []
    for fn, name in ((xbt_tip, "xbt"), (shat_tip, "btc")):
        try:
            tips.append(fn())
        except Exception as e:
            print(f"{time.strftime('%F %T')} {name}: {e}", file=sys.stderr)
    for t in tips:
        for url in TARGETS:
            try:
                push(url, key, t)
            except Exception as e:
                print(f"{time.strftime('%F %T')} push {t['chain']} -> {url}: {e}",
                      file=sys.stderr)
    st = check_feeds()
    health = " ".join(f"{n.split()[-1]}={'ok' if v['fails'] == 0 else 'fail x%d' % v['fails']}"
                      for n, v in st.items())
    print(f"{time.strftime('%F %T')} pushed " +
          ", ".join(f"{t['chain']} {t['height']}" for t in tips) + f" | {health}")


if __name__ == "__main__":
    main()
