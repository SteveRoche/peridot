import {
  RefObject,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Mutex } from 'async-mutex';
import { TypstWorkerClient } from '@/TypstWorkerClient';
import { VAULT_PACKAGES_DIR } from '@/globals';
import {
  exists,
  mkdir,
  readDir,
  readFile,
  writeFile,
} from '@tauri-apps/plugin-fs';
import untar from 'js-untar';
import { decompressSync } from 'fflate';
import { useRootConfigStore } from '@/stores/rootConfigStore';
import { useVaultSettingsStore } from '@/stores/vaultSettingsStore';

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
  const rootConfig = useRootConfigStore();
  const preamble = useVaultSettingsStore(state => state.preamble);

  const mutexRef = useRef<Mutex>(new Mutex());

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
        let missingPackages = (e as string).matchAll(
          /searched for ([\w@/:\.-]+)/g,
        );
        const openVault = rootConfig.getOpenVault();
        if (!openVault) {
          throw new Error(
            'Tried to fetch a Typst package before a vault was opened',
          );
        }
        const openVaultPath = openVault[1].path;
        for (const match of missingPackages) {
          packageNotFound = true;
          const pkg = await fetchPackage(match[1], openVaultPath);
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

export type Package = {
  spec: string;
  files: PackageFile[];
};

export type PackageFile = {
  path: string;
  bytes: Uint8Array;
};

async function fetchPackage(spec: string, vaultDir: string): Promise<Package> {
  const [_, name, version] = spec.replace(':', '/').split('/');
  const url = `https://packages.typst.org/preview/${name}-${version}.tar.gz`;
  const response = await fetch(url);
  if (response.status === 404) {
    throw 2;
  }
  const packageDir = `${vaultDir}/${VAULT_PACKAGES_DIR}/${spec}`;
  if (await exists(packageDir)) {
    const packageFiles = await collectPackageFiles(packageDir);
    return {
      spec,
      files: packageFiles,
    };
  } else {
    await mkdir(packageDir, {
      recursive: true,
    });
    const files = await untar(
      decompressSync(new Uint8Array(await response.arrayBuffer()))
        .buffer as ArrayBuffer,
    );
    let packageFiles: PackageFile[] = [];
    await Promise.all(
      files.map(async file => {
        if (file.type === '5' && file.name !== '.') {
          await mkdir(`${vaultDir}/${VAULT_PACKAGES_DIR}/${spec}/${file.name}`);
        }
        if (file.type === '0') {
          await writeFile(
            `${vaultDir}/${VAULT_PACKAGES_DIR}/${spec}/${file.name}`,
            new Uint8Array(file.buffer),
          );
          packageFiles.push({
            path: file.name,
            bytes: new Uint8Array(file.buffer),
          });
        }
      }),
    );
    return {
      spec,
      files: packageFiles,
    };
  }
}

async function collectPackageFiles(
  root: string,
  currentRelDir: string = '',
): Promise<PackageFile[]> {
  const entries = await readDir(`${root}/${currentRelDir}`);
  let files: PackageFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      files.push(
        ...(await collectPackageFiles(
          root,
          currentRelDir === ''
            ? `${entry.name}`
            : `${currentRelDir}/${entry.name}`,
        )),
      );
    } else {
      const bytes = await readFile(`${root}/${currentRelDir}/${entry.name}`);
      files.push({
        path: `${currentRelDir}/${entry.name}`, // relative path
        bytes,
      });
    }
  }

  return files;
}

export default TypstCanvas;
