const ngrok = require('@ngrok/ngrok');

async function main() {
  console.log('Starting ngrok TCP tunnel to localhost:3306...');

  // Use TcpListenerBuilder for TCP tunnels
  const listener = await ngrok.connect({
    addr: 3306,
    proto: 'tcp',
  });

  console.log('Tunnel established!');
  console.log('Endpoint:', listener.url);
  
  // Keep alive
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await ngrok.disconnect(listener.url);
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Failed to start tunnel:', err.message);
  console.error('Full error:', err);
  process.exit(1);
});