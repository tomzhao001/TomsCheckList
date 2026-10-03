export type TripItem = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  checked: boolean;
};

export type TripBag = {
  id: string;
  name: string;
  sortOrder: number;
  checked: boolean;
  items: TripItem[];
};

export function reconcileBag(bag: TripBag): TripBag {
  if (bag.items.length === 0) return bag;
  return { ...bag, checked: bag.items.every((item) => item.checked) };
}

export function toggleBagChecked(bag: TripBag, checked: boolean): TripBag {
  if (bag.items.length === 0) return { ...bag, checked };
  return {
    ...bag,
    checked,
    items: bag.items.map((item) => ({ ...item, checked })),
  };
}

export function toggleItemChecked(bag: TripBag, itemId: string, checked: boolean): TripBag {
  const items = bag.items.map((item) => (item.id === itemId ? { ...item, checked } : item));
  return reconcileBag({ ...bag, items });
}
