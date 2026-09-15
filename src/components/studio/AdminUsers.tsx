import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { grantAdmin, listUsers } from "@/lib/api/admin.functions";

export function AdminUsers() {
  const fetchUsers = useServerFn(listUsers);
  const promote = useServerFn(grantAdmin);
  const queryClient = useQueryClient();
  const [promoting, setPromoting] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
  });

  async function handlePromote(userId: string) {
    setPromoting(userId);
    try {
      await promote({ data: { userId } });
      toast.success("Pessoa promovida a administradora.");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível promover essa pessoa.");
    } finally {
      setPromoting(null);
    }
  }

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <p className="eyebrow">Pessoas cadastradas</p>
      </div>

      {isLoading && <p className="px-5 py-6 text-sm text-muted-foreground">Carregando...</p>}
      {error && (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Não foi possível carregar a lista de pessoas.
        </p>
      )}

      {data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Entrou em</TableHead>
              <TableHead className="text-right">Acesso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((user) => (
              <TableRow key={user.userId}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    {user.isAdmin ? (
                      <span className="text-sm text-muted-foreground">Administradora</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={promoting === user.userId}
                        onClick={() => void handlePromote(user.userId)}
                      >
                        {promoting === user.userId && <Spinner className="size-3.5" />}
                        {promoting === user.userId ? "Promovendo…" : "Tornar admin"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
