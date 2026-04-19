import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NewOrderDialog from "@/components/NewOrderDialog";
import { ChevronDown, Plus, ShoppingBag, Utensils } from "lucide-react";

/**
 * "New Order ▾" dropdown button with Dine-In / Take-Away quick picks.
 * Clicking an option opens NewOrderDialog with `defaultType` pre-filled so the
 * captain/cashier jumps straight to the customer-info step (and then the menu).
 */
export default function NewOrderButton({ variant = "desktop", onNavigate }) {
  const [open, setOpen] = useState(false);
  const [defaultType, setDefaultType] = useState(null);

  const start = (type) => {
    setDefaultType(type);
    setOpen(true);
    onNavigate?.();
  };

  const trigger = variant === "mobile" ? (
    <Button
      variant="outline"
      className="w-full h-11 justify-between"
      data-testid="nav-m-new-order-trigger"
    >
      <span className="inline-flex items-center gap-2">
        <Plus className="w-4 h-4" /> New Order
      </span>
      <ChevronDown className="w-4 h-4 opacity-60" />
    </Button>
  ) : (
    <Button
      className="h-9 bg-brand-500 hover:bg-brand-600 text-white"
      data-testid="nav-new-order-trigger"
    >
      <Plus className="w-4 h-4 mr-1" /> New Order
      <ChevronDown className="w-4 h-4 ml-1 opacity-80" />
    </Button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.22em] text-brand-500">
            Order type
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => start("dine_in")}
            className="py-2.5 cursor-pointer"
            data-testid="nav-new-order-dine-in"
          >
            <Utensils className="w-4 h-4 mr-2 text-brand-500" />
            <span className="font-medium">Dine-In</span>
            <span className="ml-auto text-[10px] text-brand-900/50 uppercase tracking-widest">Table</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => start("takeaway")}
            className="py-2.5 cursor-pointer"
            data-testid="nav-new-order-takeaway"
          >
            <ShoppingBag className="w-4 h-4 mr-2 text-brand-500" />
            <span className="font-medium">Take-Away</span>
            <span className="ml-auto text-[10px] text-brand-900/50 uppercase tracking-widest">Parcel</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewOrderDialog
        open={open}
        onOpenChange={setOpen}
        defaultType={defaultType}
      />
    </>
  );
}
