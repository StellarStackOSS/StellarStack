const fs = require('fs');
const path = require('path');

// Mapping of kebab-case to PascalCase
const componentMap = {
  'badge': 'Badge/Badge',
  'button': 'Button/Button',
  'card': 'Card/Card',
  'chart': 'Chart/Chart',
  'checkbox': 'Checkbox/Checkbox',
  'command': 'Command/Command',
  'context-menu': 'ContextMenu/ContextMenu',
  'dialog': 'Dialog/Dialog',
  'dropdown-menu': 'DropdownMenu/DropdownMenu',
  'input': 'Input/Input',
  'label': 'Label/Label',
  'separator': 'Separator/Separator',
  'sheet': 'Sheet/Sheet',
  'sidebar': 'Sidebar/Sidebar',
  'skeleton': 'Skeleton/Skeleton',
  'slider': 'Slider/Slider',
  'sonner': 'Sonner/Sonner',
  'spinner': 'Spinner/Spinner',
  'switch': 'Switch/Switch',
  'table': 'Table/Table',
  'tabs': 'Tabs/Tabs',
  'tooltip': 'Tooltip/Tooltip',
  'animated-number': 'AnimatedNumber/AnimatedNumber',
  'confirmation-modal': 'ConfirmationModal/ConfirmationModal',
  'console': 'Console/Console',
  'container-controls-card': 'ContainerControlsCard/ContainerControlsCard',
  'container-uptime-card': 'ContainerUptimeCard/ContainerUptimeCard',
  'cpu-card': 'CpuCard/CpuCard',
  'cpu-core-grid': 'CpuCoreGrid/CpuCoreGrid',
  'drag-drop-grid': 'DragDropGrid/DragDropGrid',
  'drop-zone': 'DropZone/DropZone',
  'fade-in': 'FadeIn/FadeIn',
  'form-modal': 'FormModal/FormModal',
  'glow-card': 'GlowCard/GlowCard',
  'gradient-text': 'GradientText/GradientText',
  'info-tooltip': 'InfoTooltip/InfoTooltip',
  'instance-name-card': 'InstanceNameCard/InstanceNameCard',
  'network-bar': 'NetworkBar/NetworkBar',
  'network-info-card': 'NetworkInfoCard/NetworkInfoCard',
  'network-usage-card': 'NetworkUsageCard/NetworkUsageCard',
  'noise-overlay': 'NoiseOverlay/NoiseOverlay',
  'page-transition': 'PageTransition/PageTransition',
  'players-online-card': 'PlayersOnlineCard/PlayersOnlineCard',
  'progress-ring': 'ProgressRing/ProgressRing',
  'pulsing-dot': 'PulsingDot/PulsingDot',
  'recent-logs-card': 'RecentLogsCard/RecentLogsCard',
  'sparkline': 'Sparkline/Sparkline',
  'system-information-card': 'SystemInformationCard/SystemInformationCard',
  'usage-bar': 'UsageBar/UsageBar',
  'usage-card': 'UsageCard/UsageCard',
  'usage-metric-card': 'UsageMetricCard/UsageMetricCard',
};

// Multi-export components (main export becomes default, others stay named)
const multiExportComponents = new Set([
  'dialog',
  'dropdown-menu',
  'sidebar',
  'command',
  'context-menu',
  'table',
  'tabs',
  'sheet',
]);

function updateImports(content) {
  let updated = content;
  
  // For each component, find and replace imports
  for (const [kebabCase, pascalCase] of Object.entries(componentMap)) {
    // Create escaped kebab case for regex
    const escapedKebab = kebabCase.replace(/-/g, '\-');
    
    // Match: import { ... } from "@stellarUI/components/kebab-case"
    // Use [\s\S] to match any character including newlines inside braces
    const multiLineRegex = new RegExp(
      `import\s*\{([^}]+)\}\s*from\s*["']@stellarUI/components/${escapedKebab}["']`,
      'g'
    );
    
    updated = updated.replace(multiLineRegex, (match, imports) => {
      // Split by comma, accounting for multiple imports per line
      const importList = imports
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s.length > 0);
      
      if (multiExportComponents.has(kebabCase)) {
        // For multi-export: first is default, rest are named
        if (importList.length > 1) {
          const [mainComponent, ...others] = importList;
          return `import ${mainComponent}, { ${others.join(', ')} } from "@stellarUI/components/${pascalCase}"`;
        }
        return `import ${importList[0]} from "@stellarUI/components/${pascalCase}"`;
      } else {
        // For single export: just the component name
        return `import ${importList[0]} from "@stellarUI/components/${pascalCase}"`;
      }
    });
  }
  
  return updated;
}

// Test
const testContent = `import { Badge } from "@stellarUI/components/badge";
import { Button } from "@stellarUI/components/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from "@stellarUI/components/dialog";
import {
  Sidebar,
  SidebarContent,
} from "@stellarUI/components/sidebar";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@stellarUI/components/command";`;

console.log('=== Test ===\n');
const result = updateImports(testContent);
console.log(result);
