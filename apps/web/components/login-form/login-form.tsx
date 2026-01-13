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
import { FunctionComponent } from "react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  isLoading?: boolean;
  error?: string;
  handleLogin?: (values: LoginValues) => Promise<void>;
}

const LoginForm: FunctionComponent<LoginFormProps> = ({ isLoading, error, handleLogin }) => {
  const form = useForm<LoginValues>({
    //@ts-ignore
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: LoginValues) {
    await handleLogin?.(values);
  }

  return (
    <FadeIn>
      <div className="z-10 flex flex-col items-center justify-center gap-8 py-4 duration-300 hover:scale-101">
        <img src="/logo.png" className="w-12" />
        <TextureCardStyled className="bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]">
          <TextureCardHeader className="py-2 text-sm first:pt-2">
            <p className="text-center">Sign in to your account</p>
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
                        <Input
                          placeholder="example@stellarstack.app"
                          type="email"
                          autoComplete="email"
                          {...field}
                        />
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
                  className="w-full"
                  disabled={isSubmitting || isLoading}
                >
                  <div className="flex items-center justify-center gap-1">
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
