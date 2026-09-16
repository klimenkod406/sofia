'use client';

import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Sparkles, Cpu, Cloud, Download, Check } from 'lucide-react';
import { AIModel } from '@/types';

interface ModelSelectorProps {
  currentModel: AIModel | null;
  models: AIModel[];
  onSelect: (model: AIModel) => void;
}

export function ModelSelector({ currentModel, models, onSelect }: ModelSelectorProps) {
  const localModels = models.filter(m => m.source === 'local' && m.is_downloaded);
  const apiModels = models.filter(m => m.source === 'api');
  const availableModels = models.filter(
    m => m.is_active && (m.is_downloaded || m.source === 'api')
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 h-9 px-3" aria-label="Select AI model">
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline truncate max-w-[150px]">
            {currentModel?.name || 'Select Model'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center gap-2 px-1">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <span>Available Models</span>
        </DropdownMenuLabel>

        {localModels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Cpu className="w-3 h-3" />
              <span>Local Models</span>
            </DropdownMenuLabel>
            {localModels.map(model => (
              <DropdownMenuItem
                key={model.id}
                onSelect={() => onSelect(model)}
                className={cn(
                  'flex items-center gap-2',
                  currentModel?.id === model.id && 'bg-primary/10'
                )}
              >
                <span className="w-2 h-2 rounded-full bg-green-500" title="Downloaded" />
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'truncate font-medium',
                      currentModel?.id === model.id && 'text-primary'
                    )}
                  >
                    {model.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {model.quantization} ·{' '}
                    {model.size_bytes > 0
                      ? `${(model.size_bytes / 1e9).toFixed(1)}GB`
                      : 'Unknown size'}
                  </p>
                </div>
                {currentModel?.id === model.id && <Check className="w-4 h-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {apiModels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Cloud className="w-3 h-3" />
              <span>API Models</span>
            </DropdownMenuLabel>
            {apiModels.map(model => (
              <DropdownMenuItem
                key={model.id}
                onSelect={() => onSelect(model)}
                className={cn(
                  'flex items-center gap-2',
                  currentModel?.id === model.id && 'bg-primary/10'
                )}
              >
                <span className="w-2 h-2 rounded-full bg-blue-500" title="API" />
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'truncate font-medium',
                      currentModel?.id === model.id && 'text-primary'
                    )}
                  >
                    {model.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{model.api_endpoint}</p>
                </div>
                {currentModel?.id === model.id && <Check className="w-4 h-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {availableModels.length === 0 && (
          <DropdownMenuItem className="text-center text-muted-foreground py-4">
            No models available. Go to Settings to add models.
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            /* Navigate to model settings */
          }}
          className="text-center"
        >
          <Download className="w-4 h-4 mr-2" />
          Manage Models
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
