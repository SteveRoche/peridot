import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { Button, buttonVariants } from './ui/button';
import { VaultTreeNode } from '@/types';
import { TYPST_EXTENSION } from '@/globals';

type FileExplorerViewProps = {
  fileTree: VaultTreeNode[];
  basePath?: string;
  onSelectFile: (relativePath: string) => void;
};

const formatFilename = (filename: string) =>
  filename.endsWith(TYPST_EXTENSION)
    ? filename.slice(0, filename.length - TYPST_EXTENSION.length)
    : filename;

export default function FileExplorerView({
  fileTree,
  basePath = '',
  onSelectFile,
}: FileExplorerViewProps) {
  const onFileClick =
    (relativePath: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onSelectFile(relativePath);
    };

  return (
    <aside>
      {fileTree
        .filter(entry => entry.name !== '.peridot')
        .map(entry =>
          entry.children ? (
            entry.children.length > 0 ? (
              <Accordion key={entry.name} type="multiple">
                <AccordionItem
                  value={
                    basePath === '' ? entry.name : `${basePath}/${entry.name}`
                  }
                  className="border-b-0">
                  <AccordionTrigger
                    className={cn(
                      buttonVariants({ size: 'sm', variant: 'ghost' }),
                      'justify-between',
                      'hover:no-underline',
                    )}>
                    {formatFilename(entry.name)}
                  </AccordionTrigger>
                  <AccordionContent className="pl-2 pb-0">
                    <FileExplorerView
                      fileTree={entry.children}
                      basePath={
                        basePath === ''
                          ? entry.name
                          : `${basePath}/${entry.name}`
                      }
                      onSelectFile={onSelectFile}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              <Button
                key={entry.name}
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                disabled>
                {formatFilename(entry.name)}
              </Button>
            )
          ) : (
            <Button
              key={entry.name}
              size="sm"
              variant="ghost"
              className="w-full justify-start"
              onClick={onFileClick(
                basePath === '' ? entry.name : `${basePath}/${entry.name}`,
              )}>
              {formatFilename(entry.name)}
            </Button>
          ),
        )}
    </aside>
  );
}
