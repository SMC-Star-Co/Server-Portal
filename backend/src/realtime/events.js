const realtimeClients = new Set();

// Events are invalidations, never invoice/user IDs or business data.
// All actual data is fetched through permission-checked API routes.
function broadcastRealtimeEvent(type) {
  const data = JSON.stringify({ type });
  for (const client of realtimeClients) {
    try {
      if (client.destroyed || !client.write('event: portal-update\ndata: ' + data + '\n\n')) {
        realtimeClients.delete(client);
        client.destroy();
      }
    } catch {
      realtimeClients.delete(client);
      client.destroy();
    }
  }
}
module.exports = { realtimeClients, broadcastRealtimeEvent };
