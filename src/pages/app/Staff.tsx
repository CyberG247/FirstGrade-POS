import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole, Role } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface StaffRow { id: string; user_id: string; role: Role; created_at: string; }

const Staff = () => {
  const { user } = useAuth();
  const { role: myRole, businessOwnerId, perms, loading } = useRole();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [newRole, setNewRole] = useState<Role>("cashier");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!businessOwnerId) return;
    const { data } = await supabase.from("user_roles").select("*").eq("business_owner_id", businessOwnerId).order("created_at");
    setStaff((data || []) as StaffRow[]);
  };
  useEffect(() => { load(); }, [businessOwnerId]);

  const inviteStaff = async () => {
    if (!email || !password || password.length < 6) return toast.error("Email and password (6+ chars) required");
    setBusy(true);
    try {
      // Sign the new staff user up (they get an admin role for themselves by default trigger,
      // then we additionally attach them to this business with the chosen role).
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
      const newUserId = data.user?.id;
      if (newUserId && businessOwnerId && newUserId !== businessOwnerId) {
        const { error: rErr } = await supabase
          .from("user_roles")
          .insert({ user_id: newUserId, business_owner_id: businessOwnerId, role: newRole });
        if (rErr) throw rErr;
      }
      toast.success(`Staff invited as ${newRole}`);
      setOpen(false); setEmail(""); setPassword(""); setFullName(""); setNewRole("cashier");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to invite staff");
    } finally { setBusy(false); }
  };

  const updateRole = async (rowId: string, role: Role) => {
    const { error } = await supabase.from("user_roles").update({ role }).eq("id", rowId);
    if (error) toast.error(error.message); else { toast.success("Role updated"); load(); }
  };

  const removeStaff = async (row: StaffRow) => {
    if (row.user_id === businessOwnerId) return toast.error("Cannot remove the business owner");
    const { error } = await supabase.from("user_roles").delete().eq("id", row.id);
    if (error) toast.error(error.message); else { toast.success("Staff removed"); load(); }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  if (!perms.canManageStaff) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="rounded-lg border bg-card p-8 text-center shadow-card">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Access restricted</h2>
          <p className="text-sm text-muted-foreground mt-1">Only Admins can manage staff accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Staff & Roles</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage who can access POS, inventory and refunds</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Invite Staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite Staff Member</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Temporary Password</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></div>
              <div>
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Cashier — POS only</SelectItem>
                    <SelectItem value="manager">Manager — POS, Inventory, Refunds</SelectItem>
                    <SelectItem value="admin">Admin — Full access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={inviteStaff} disabled={busy}>{busy ? "Inviting…" : "Send Invite"}</Button>
              <p className="text-xs text-muted-foreground">Share the email + password with the staff member; they should change it after first sign-in.</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">User ID</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {staff.map((s) => {
              const isOwner = s.user_id === businessOwnerId;
              const isMe = s.user_id === user?.id;
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.user_id.slice(0, 8)}…{isOwner && <Badge className="ml-2" variant="secondary">Owner</Badge>}{isMe && <Badge className="ml-2">You</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {isOwner ? (
                      <Badge>Admin</Badge>
                    ) : (
                      <Select value={s.role} onValueChange={(v) => updateRole(s.id, v as Role)}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cashier">Cashier</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {!isOwner && (
                      <Button size="icon" variant="ghost" onClick={() => removeStaff(s)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border bg-card p-4"><div className="font-semibold mb-1">Cashier</div><div className="text-muted-foreground text-xs">POS checkout only. Cannot edit inventory or process refunds.</div></div>
        <div className="rounded-lg border bg-card p-4"><div className="font-semibold mb-1">Manager</div><div className="text-muted-foreground text-xs">POS, manage inventory and process refunds. Cannot manage staff.</div></div>
        <div className="rounded-lg border bg-card p-4"><div className="font-semibold mb-1">Admin</div><div className="text-muted-foreground text-xs">Full access including staff management and reports.</div></div>
      </div>
    </div>
  );
};

export default Staff;
