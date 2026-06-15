import { AuthLayout } from "@/features/auth/components/auth-layout";
import { RegisterForm } from "@/features/auth/components/register-form";

// Publicly accessible student-aspirant (applicant) registration.
function RegisterPage() {
  return (
    <AuthLayout
      subtitle="Student Aspirant Registration"
      contentClassName="max-w-xl"
    >
      <RegisterForm />
    </AuthLayout>
  );
}

export default RegisterPage;
