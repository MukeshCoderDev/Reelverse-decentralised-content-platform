
import React from 'react';
import Button from '../Button';
import { format } from 'path';

export function ContentTable({ rows }: { rows: { id: string; title: string; status: string; views: number; }[] }) {
    return (
        <div className="border rounded-lg">
            <table className="w-full text-sm">
                <thead className="text-left">
                    <tr className="border-b">
                        <th className="p-3 font-medium text-muted-foreground">Title</th>
                        <th className="p-3 font-medium text-muted-foreground">Status</th>
                        <th className="p-3 font-medium text-muted-foreground">Views</th>
                        <th className="p-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.id} className="border-t border-border">
                            <td className="p-3 font-medium">{r.title}</td>
                            <td className="p-3">
                                <span className={`px-2 py-1 text-xs rounded-full ${r.status === 'READY' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                    {r.status}
                                </span>
                            </td>
                            <td className="p-3 text-muted-foreground">{r.views.toLocaleString()}</td>
                            <td className="p-3 text-right">
                                <Button variant="outline" size="sm">Edit</Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
