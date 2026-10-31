const realtimeClients = new Set();

function broadcastRealtimeEvent(type, payload = {}) {
  const data = JSON.stringify({ type, payload, at: new Date().toISOString() });
  for (const client of realtimeClients) {
    try {
      client.write(`event: portal-update
data: ${data}

`);
    } catch (err) {
      realtimeClients.delete(client);
    }
  }
}

module.exports = { realtimeClients, broadcastRealtimeEvent };
