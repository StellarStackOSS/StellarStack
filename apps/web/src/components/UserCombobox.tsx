import { useState } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

import { useAdminUsers } from "@/hooks/useAdminUsers"

type Props = {
  value: string
  onChange: (userId: string) => void
}

export const UserCombobox = ({ value, onChange }: Props) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { data } = useAdminUsers()
  const users = data?.users ?? []

  const selected = users.find((u) => u.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
        >
          <span className={cn("truncate text-sm", !selected && "text-muted-foreground")}>
            {selected
              ? `${selected.name} — ${selected.email}`
              : t("admin_servers.field.owner_placeholder")}
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={12}
            className={cn("ml-2 shrink-0 opacity-50 transition-transform", open && "rotate-180")}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder={t("admin_servers.field.owner_search")} />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              {t("admin_servers.field.owner_empty")}
            </CommandEmpty>
            <CommandGroup className="p-1">
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={`${u.name} ${u.email}`}
                  onSelect={() => {
                    onChange(u.id)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium leading-tight">{u.name}</span>
                    <span className="truncate text-muted-foreground leading-tight">{u.email}</span>
                  </div>
                  {value === u.id && (
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      size={13}
                      className="shrink-0 text-primary"
                    />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
