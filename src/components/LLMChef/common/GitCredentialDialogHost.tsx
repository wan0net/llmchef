import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitCredentialDialogService } from "@/services/git-credential-dialog.service";

export function GitCredentialDialogHost() {
  const { t } = useTranslation(["git", "common"]);
  const [request, setRequest] = useState(GitCredentialDialogService.getCurrentRequest());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    return GitCredentialDialogService.subscribe(() => {
      const current = GitCredentialDialogService.getCurrentRequest();
      setRequest(current);
      if (current) {
        setUsername("");
        setPassword("");
      }
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    GitCredentialDialogService.resolveCurrent({ username, password });
  };

  const handleCancel = () => {
    GitCredentialDialogService.resolveCurrent(null);
  };

  const url = request?.url ?? "";

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("git:credentialDialog.title", "Git Authentication")}</DialogTitle>
            <DialogDescription>
              {t("git:credentialDialog.description", "Enter credentials for {{url}}", { url })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="git-username">{t("git:credentialDialog.username", "Username")}</Label>
              <Input
                id="git-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="git-password">{t("git:credentialDialog.password", "Password / Token")}</Label>
              <Input
                id="git-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t("common:cancel", "Cancel")}
            </Button>
            <Button type="submit" disabled={!username || !password}>
              {t("common:ok", "OK")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
