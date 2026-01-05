import {
  RefObject,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Mutex } from 'async-mutex';
import { TypstWorkerClient } from '@/TypstWorkerClient';
import { useVaultSettingsStore } from '@/stores/vaultSettingsStore';
import { useVaultStore } from '@/stores/vaultStore';

export type PlainLinkDesc = {
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
};

type RenderResult = {
  width: number;
  height: number;
  data: Uint8Array;
  links: PlainLinkDesc[];
};

const inside = (
  rect: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number },
) => {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
};

export type TypstCanvasProps = {
  ref: RefObject<TypstCanvasHandle | null>;
  filePath: string;
  onLinkCallback?: (url: string) => void;
};

export type TypstCanvasHandle = {
  render: (source: string) => void;
};

const TypstCanvas: React.FC<TypstCanvasProps> = ({
  ref,
  filePath,
  onLinkCallback,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<TypstWorkerClient>(null);
  const [docLinks, setDocLinks] = useState<PlainLinkDesc[]>([]);
  const preamble = useVaultSettingsStore(state => state.preamble);

  const mutexRef = useRef<Mutex>(new Mutex());

  const fetchPackage = useVaultStore(state => state.fetchPackage);

  useEffect(() => {
    workerRef.current = new TypstWorkerClient();
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    const handleLinkClick = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const canvasPoint = {
        x: (event.x - rect.left) * window.devicePixelRatio,
        y: (event.y - rect.top) * window.devicePixelRatio,
      };
      const clickedLink = docLinks.find(link => inside(link, canvasPoint));
      if (clickedLink) {
        if (onLinkCallback) {
          onLinkCallback(clickedLink.url);
        }
      }
    };

    canvas.addEventListener('pointerdown', handleLinkClick);
    return () => canvas.removeEventListener('pointerdown', handleLinkClick);
  }, [docLinks]);

  const executeRender = async (newSource: string) => {
    if (!canvasRef.current || !workerRef.current) return;
    const canvas = canvasRef.current;

    const dpi = window.devicePixelRatio;
    while (true) {
      try {
        const { width, height, data, links } =
          await workerRef.current.executeTask<RenderResult>({
            type: 'RENDER',
            source: `${preamble}\n${newSource}`,
            filePath,
            dpi,
          });
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        canvas.style.width = `${width / dpi}px`;
        canvas.style.height = `${height / dpi}px`;
        canvas.width = width;
        canvas.height = height;

        const imageData = ctx.createImageData(width, height);
        imageData.data.set(data);
        ctx.putImageData(imageData, 0, 0);
        setDocLinks(links);
        break;
      } catch (e) {
        let packageNotFound = false;
        const missingPackages = (e as string).matchAll(
          /searched for ([\w@/:\.-]+)/g,
        );
        for (const [_, match] of missingPackages) {
          packageNotFound = true;
          const pkg = await fetchPackage(match);
          await workerRef.current.executeTask<void>({
            type: 'ADD_PACKAGE',
            package: pkg,
          });
        }
        if (!packageNotFound) {
          throw e;
        }
      }
    }
  };

  const renderSource = (newSource: string) => {
    mutexRef.current
      .runExclusive(async () => executeRender(newSource))
      .catch(e => console.error(e));
  };

  useImperativeHandle(ref, () => ({
    render: renderSource,
  }));

  return <canvas ref={canvasRef}></canvas>;
};

export default TypstCanvas;
