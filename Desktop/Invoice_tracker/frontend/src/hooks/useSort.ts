import { useState } from 'react';

export type SortValue = string | number;

export function useSort<T>(getValue: (row: T, col: string) => SortValue) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else { setSortCol(col); setSortDir('asc'); }
  };

  const sortArrow = (col: string) =>
    sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  const sortRows = (rows: T[]): T[] => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const va = getValue(a, sortCol);
      const vb = getValue(b, sortCol);
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  };

  return { sortCol, sortDir, toggleSort, sortArrow, sortRows };
}
