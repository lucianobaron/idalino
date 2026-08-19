import { LoginForm } from "@/components/admin/login-form";

export const metadata = { title: "Login do Admin" };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <LoginForm />
    </div>
  );
}
