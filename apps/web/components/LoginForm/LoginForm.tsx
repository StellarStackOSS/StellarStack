"use client";

import {
  TextureCardContent,
  TextureCardFooter,
  TextureCardHeader,
  TextureCardStyled,
  TextureSeparator,
} from "@workspace/ui/components/texture-card";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { FadeIn, Input, Spinner } from "@workspace/ui/components";
import { BsApple, BsDiscord, BsGoogle } from "react-icons/bs";
import { ArrowRight } from "lucide-react";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { FunctionComponent, useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { LiquidMetal } from "@paper-design/shaders-react";
import { Turnstile } from "@/components/Turnstile/Turnstile";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  isLoading?: boolean;
  error?: string;
  handleLogin?: (values: LoginValues & { captchaToken: string }) => Promise<void>;
}

const LoginForm: FunctionComponent<LoginFormProps> = ({ isLoading, error, handleLogin }) => {
  const [captchaToken, setCaptchaToken] = useState<string>("");

  const form = useForm<LoginValues>({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - zodResolver has version mismatch with zod
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: LoginValues) {
    await handleLogin?.({ ...values, captchaToken });
  }

  return (
    <FadeIn>
      <div className="z-10 flex flex-col items-center justify-center gap-8 py-4 duration-300 hover:scale-101">
        <TextureCardStyled className="bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]">
          <TextureCardHeader className="flex items-center justify-center py-2 text-sm first:pt-2">
            <img src="/logo.png" className="w-18" />
          </TextureCardHeader>

          <TextureSeparator />

          <TextureCardContent>
            {/* OAuth buttons */}
            <div className="mb-4 flex justify-center gap-2">
              <TextureButton variant="icon">
                <BsGoogle />
                <span className="pl-2">Google</span>
              </TextureButton>
              <TextureButton variant="icon">
                <BsApple />
                <span className="pl-2">Apple</span>
              </TextureButton>
              <TextureButton variant="icon">
                <BsDiscord />
                <span className="pl-2">Discord</span>
              </TextureButton>
            </div>

            <div className="mb-4 text-center text-sm">or</div>

            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <TextureButton
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || isLoading}
                  className="relative h-[46px] w-full overflow-hidden p-0 transition-transform duration-200 hover:scale-[1.01]"
                >
                  <div className="pointer-events-none absolute inset-0">
                    <LiquidMetal
                      width={600}
                      height={56}
                      colorBack="#aaaaac00"
                      colorTint="#ffffff"
                      shape="none"
                      repetition={2}
                      softness={1}
                      shiftRed={0.3}
                      shiftBlue={0.3}
                      distortion={0}
                      contour={1}
                      angle={70}
                      speed={0.2}
                      scale={5}
                      rotation={0}
                      fit="contain"
                    />
                  </div>
                  <div
                    className={cn(
                      "absolute inset-[2px] z-10",
                      "flex items-center justify-center",
                      "rounded-[inherit]",
                      "bg-black/40 dark:bg-white/60",
                      "backdrop-blur-md backdrop-saturate-150",
                      "border border-white/10 dark:border-black/10",
                      "text-sm font-medium tracking-wider uppercase"
                    )}
                  >
                    {isSubmitting || isLoading ? (
                      <Spinner />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="mt-[1px] h-4 w-4" />
                      </>
                    )}
                  </div>
                </TextureButton>
                <Turnstile
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken("")}
                  onError={() => setCaptchaToken("")}
                />
                {error && <p className="text-center text-xs text-red-400">{error}</p>}
              </form>
            </Form>
          </TextureCardContent>

          <TextureSeparator />

          <TextureCardFooter className="flex flex-col gap-4">
            <div className="text-center text-xs">
              Don't have an account?{" "}
              <span className="text-primary cursor-pointer underline hover:opacity-50">
                Sign up
              </span>
            </div>
          </TextureCardFooter>
        </TextureCardStyled>
      </div>
    </FadeIn>
  );
};
export default LoginForm;
