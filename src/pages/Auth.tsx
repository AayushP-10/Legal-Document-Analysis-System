import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Scale } from "lucide-react";
import { loginUser } from "@/lib/auth";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // Mock authentication: Use the email as the user profile identifier
    loginUser(email);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm border-border shadow-md">
        <CardHeader className="space-y-3 items-center text-center">
          <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <Scale className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-serif">Legal Vault</CardTitle>
            <CardDescription>
              {isLogin ? "Sign in to access your secure documents" : "Create an account to get started"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
            <Input type="password" placeholder="Password" required />
            <Button type="submit" className="w-full">
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground mt-4">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
