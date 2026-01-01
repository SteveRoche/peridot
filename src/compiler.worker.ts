import init, { render, load_package } from '../src-wasm/pkg/src_wasm';
import { PlainLinkDesc } from './components/VaultView/TypstCanvas';
import { TypstWorkerMessage } from './TypstWorkerClient';

let ready = false;

declare global {
  function requestData(spec: string): void;
}

globalThis.window = self;

self.onmessage = async (event: MessageEvent<TypstWorkerMessage>) => {
  const message = event.data;
  if (message.type === 'INIT') {
    await init();
    ready = true;
    postMessage({ id: message.id, type: 'READY' });
  } else if (message.type === 'RENDER') {
    if (!ready) return;
    try {
      const { width, height, data, links } = render(
        message.source,
        message.filePath,
        message.dpi,
      );
      const linksDeref = links.map(
        ({ x, y, width, height, url }: PlainLinkDesc) => ({
          x,
          y,
          width,
          height,
          url,
        }),
      );
      postMessage({
        id: message.id,
        result: { width, height, data, links: linksDeref },
      });
    } catch (e) {
      postMessage({ id: message.id, error: e });
    }
  } else if (message.type === 'ADD_PACKAGE') {
    load_package(message.package);
    postMessage({ id: message.id });
  }
};
