import { type ReactElement } from 'react';

export interface SrDataTableProps {
  readonly caption: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly (string | number)[])[];
}

/**
 * Screen-reader accessible tabular companion paired with inline SVG charts and graphs.
 */
export function SrDataTable({ caption, headers, rows }: SrDataTableProps): ReactElement {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rIdx) => (
            <tr key={`${String(cells[0] ?? rIdx)}-${String(rIdx)}`}>
              {cells.map((cell, cIdx) => (
                <td key={String(cIdx)}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
