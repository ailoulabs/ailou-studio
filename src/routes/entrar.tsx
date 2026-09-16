import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar no AiLou Studio" },
      {
        name: "description",
        content:
          "Acesse o AiLou Studio com seu celular e continue criando suas coleções de estampas.",
      },
      { property: "og:title", content: "Entrar no AiLou Studio" },
      {
        property: "og:description",
        content: "Receba um código por mensagem e entre no seu espaço de criação.",
      },
    ],
  }),
  component: LoginPage,
});

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function toE164(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10 || d.length > 11) return null;
  return `+55${d}`;
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("token has expired") || m.includes("invalid"))
    return "Código inválido ou expirado. Peça um novo.";
  if (m.includes("already registered")) return "Este e-mail já tem conta. Tente entrar.";
  if (m.includes("weak") || m.includes("pwned"))
    return "Essa senha é fácil de adivinhar. Escolha outra, mais longa e única.";
  if (m.includes("password")) return "A senha precisa de pelo menos 6 caracteres.";

  if (m.includes("unsupported phone provider") || m.includes("sms"))
    return "O envio de mensagens ainda não está configurado. Use a entrada por e-mail abaixo.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Espere um pouco e tente de novo.";
  return "Não foi possível concluir. Tente novamente.";
}

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"telefone" | "email">("telefone");
  const [step, setStep] = useState<"identificar" | "codigo">("identificar");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/studio" });
  }, [loading, session, navigate]);

  async function sendCode() {
    const e164 = toE164(phone);
    if (!e164) {
      toast.error("Digite o celular com DDD, por exemplo (11) 90000-0000.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error.message));
      return;
    }
    setStep("codigo");
    toast.success("Código enviado por mensagem.");
  }

  async function confirmCode() {
    const e164 = toE164(phone);
    if (!e164) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: "sms" });
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error.message));
      return;
    }
    void navigate({ to: "/studio" });
  }

  async function emailSubmit(kind: "entrar" | "criar") {
    if (!email.includes("@") || password.length < 6) {
      toast.error("Informe um e-mail válido e uma senha com pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    const { error } =
      kind === "entrar"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/studio` },
          });
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error.message));
      return;
    }
    void navigate({ to: "/studio" });
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-88px)] max-w-md flex-col justify-center px-4 py-12">
      <img src="/ailou-emblem.png" alt="AiLou" className="mx-auto h-24 w-auto" />

      <div className="surface-card mt-8 p-6 sm:p-7">
        {mode === "email" ? (
          <>
            <p className="eyebrow">Entrada para testes</p>
            <h1 className="mt-2 text-2xl">Entrar com e-mail</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enquanto o envio de mensagens não está ligado, use e-mail e senha.
            </p>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Seu e-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Sua senha</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="mt-6 w-full"
              size="lg"
              disabled={busy}
              onClick={() => void emailSubmit("entrar")}
            >
              {busy && <Spinner />}
              {busy ? "Entrando…" : "Entrar"}
            </Button>
            <Button
              variant="outline"
              className="mt-2 w-full"
              disabled={busy}
              onClick={() => void emailSubmit("criar")}
            >
              {busy && <Spinner />}
              {busy ? "Criando…" : "Criar conta"}
            </Button>
            <button
              type="button"
              className="mt-5 w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode("telefone")}
            >
              Voltar para a entrada por celular
            </button>
          </>
        ) : step === "identificar" ? (
          <>
            <p className="eyebrow">Seu espaço de criação</p>
            <h1 className="mt-2 text-2xl">Entrar no Studio</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enviamos um código de 6 dígitos por mensagem.
            </p>
            <div className="mt-6 space-y-2">
              <Label htmlFor="celular">Seu celular com DDD</Label>
              <Input
                id="celular"
                inputMode="tel"
                placeholder="(11) 90000-0000"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
              />
            </div>
            <Button className="mt-6 w-full" size="lg" disabled={busy} onClick={() => void sendCode()}>
              {busy && <Spinner />}
              {busy ? "Enviando…" : "Receber código"}
            </Button>
            <button
              type="button"
              className="mt-5 w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode("email")}
            >
              Entrar com e-mail
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">Quase lá</p>
            <h1 className="mt-2 text-2xl">Digite o código</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enviamos 6 dígitos para {phone || "o seu celular"}.
            </p>
            <div className="mt-6 flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              className="mt-6 w-full"
              size="lg"
              disabled={code.length < 6 || busy}
              onClick={() => void confirmCode()}
            >
              {busy && <Spinner />}
              {busy ? "Confirmando…" : "Entrar"}
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setStep("identificar")}>
              Trocar de número
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
