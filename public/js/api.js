// Cliente da API REST e do WebSocket, compartilhado pelo painel e pela projecao.

export async function api(path, params = {}) {
  const url = new URL(path, location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  const data = await response.json().catch(() => ({ error: 'Resposta inválida do servidor.' }));
  if (!response.ok) throw new Error(data.error ?? `Erro ${response.status}`);
  return data;
}

/**
 * Mantem a conexao viva sozinha: se o servidor reiniciar no meio do culto, a
 * janela volta a se conectar e recebe o slide atual sem ninguem tocar nela.
 */
export function connect({ onState, onStatus, onError } = {}) {
  let socket = null;
  let attempt = 0;
  let closed = false;

  function open() {
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);

    socket.addEventListener('open', () => {
      attempt = 0;
      onStatus?.('online');
    });

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'state') onState?.(message.payload);
      else if (message.type === 'error') onError?.(message.payload.message);
    });

    socket.addEventListener('close', () => {
      onStatus?.('offline');
      if (closed) return;
      attempt += 1;
      setTimeout(open, Math.min(500 * attempt, 5000));
    });

    socket.addEventListener('error', () => socket.close());
  }

  open();

  return {
    send(type, payload = {}) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, payload }));
    },
    close() {
      closed = true;
      socket?.close();
    },
  };
}
