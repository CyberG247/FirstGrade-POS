import { useState } from "react";
import { useBranches } from "@/hooks/useBranches";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const Branches = () => {
  const { perms, businessOwnerId } = useRole();
  const { branches, multiBranchEnabled, setMultiBranchEnabled, activeBranchId, setActiveBranchId, reload } = useBranches();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  if (!perms.canManageStaff) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="rounded-lg border bg-card p-8 text-center shadow-card">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Admin only</h2>
          <p className="text-sm text-muted-foreground mt-1">Branch management is restricted to business admins.</p>
        </div>
      </div>
    );
  }

  const openCreate = () => { setEditing({ name: "", code: "", address: "", phone: "", is_active: true }); setOpen(true); };
  const openEdit = (b: any) => { setEditing({ ...b }); setOpen(true); };

  const handleSave = async () => {
    if (!editing.name?.trim()) return toast.error("Branch name is required");
    const payload = {
      name: editing.name.trim(),
      code: editing.code?.trim() || null,
      address: editing.address?.trim() || null,
      phone: editing.phone?.trim() || null,
      is_active: editing.is_active,
      business_owner_id: businessOwnerId,
    };
    const { error } = editing.id
      ? await supabase.from("branches").update(payload).eq("id", editing.id)
      : await supabase.from("branches").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Branch updated" : "Branch created");
    setOpen(false);
    reload();
  };

  const handleDelete = async (b: any) => {
    if (!confirm(`Delete branch "${b.name}"? Receipt settings for this branch will also be removed.`)) return;
    const { error } = await supabase.from("branches").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Branch deleted");
    reload();
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Branches
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your store locations and pick which one you're operating from.</p>
        </div>
        <Button onClick={openCreate} disabled={!multiBranchEnabled}><Plus className="h-4 w-4 mr-1" /> New branch</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Multi-branch operations</CardTitle>
          <CardDescription>Enable to manage multiple stores and apply receipt settings per branch.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="text-sm">
            <div className="font-medium">Status: {multiBranchEnabled ? "Enabled" : "Disabled"}</div>
            <div className="text-muted-foreground text-xs mt-0.5">When disabled, all sales use the business-wide receipt settings.</div>
          </div>
          <Switch checked={multiBranchEnabled} onCheckedChange={async (v) => {
            await setMultiBranchEnabled(v);
            toast.success(`Multi-branch ${v ? "enabled" : "disabled"}`);
          }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>{branches.length} branch{branches.length !== 1 && "es"}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {branches.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {multiBranchEnabled
                ? "No branches yet. Create your first store location to assign per-branch receipt settings."
                : "Enable multi-branch operations above to start adding store locations."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Code</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Address</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {branches.map(b => (
                  <tr key={b.id} className="hover:bg-secondary/40">
                    <td className="px-4 py-3 font-medium">
                      {b.name}
                      {activeBranchId === b.id && <Badge variant="secondary" className="ml-2 text-[10px]">Active</Badge>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{b.code || "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground truncate max-w-xs">{b.address || "—"}</td>
                    <td className="px-4 py-3">
                      {b.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {multiBranchEnabled && activeBranchId !== b.id && (
                        <Button size="sm" variant="ghost" onClick={async () => { await setActiveBranchId(b.id); toast.success(`Operating from ${b.name}`); }}>
                          Set active
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(b)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit branch" : "New branch"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ikeja Branch" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Code</Label><Input value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="LAG-IKJ" /></div>
                <div><Label>Phone</Label><Input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="+234…" /></div>
              </div>
              <div><Label>Address</Label><Input value={editing.address || ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} placeholder="12 Allen Avenue, Ikeja" /></div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>Active</Label>
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Branches;