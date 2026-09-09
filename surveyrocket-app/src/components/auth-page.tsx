import { useEffect, useRef, useState } from "react";
import { Particles } from "@/components/ui/particles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
	ChevronLeftIcon,
	EyeIcon,
	EyeOffIcon,
	FingerprintIcon,
} from "lucide-react";

export type AuthPageProps = {
	next: string;
	emailPrefill: string;
	initialMethod: "password" | "magic";
	sent: boolean;
	reset: boolean;
	error: string | null;
	waitParam: number;
	supabasePublicUrl: string;
	supabaseKey: string;
};

const waitKey = "sr.magicWait";

function readWait(email: string) {
	try {
		const raw = sessionStorage.getItem(waitKey);
		if (!raw) return 0;
		const data = JSON.parse(raw) as { email?: string; until?: number };
		if (email && data.email && data.email !== email) return 0;
		return Math.max(0, Math.ceil(((data.until || 0) - Date.now()) / 1000));
	} catch {
		return 0;
	}
}

function writeWait(email: string, seconds: number) {
	sessionStorage.setItem(
		waitKey,
		JSON.stringify({ email, until: Date.now() + seconds * 1000 })
	);
}

export function AuthPage({
	next,
	emailPrefill,
	initialMethod,
	sent,
	reset,
	error: initialError,
	waitParam,
	supabasePublicUrl,
	supabaseKey,
}: AuthPageProps) {
	const [method, setMethod] = useState<"password" | "magic">(initialMethod);
	const [showPassword, setShowPassword] = useState(false);
	const [ok, setOk] = useState(
		reset
			? "Check your email for a link to choose your password."
			: sent
				? "Check your email for the magic link."
				: ""
	);
	const [error, setError] = useState(initialError || "");
	const [waitLeft, setWaitLeft] = useState(0);
	const [magicBusy, setMagicBusy] = useState(false);
	const [passwordBusy, setPasswordBusy] = useState(false);
	const [passkeyBusy, setPasskeyBusy] = useState(false);
	const passwordBusyRef = useRef(false);
	const magicEmailRef = useRef<HTMLInputElement>(null);
	const passwordEmailRef = useRef<HTMLInputElement>(null);
	const resetEmailRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const email =
			magicEmailRef.current?.value?.trim() || emailPrefill || "";
		const initial = waitParam || readWait(email);
		if (initial > 0) {
			writeWait(email, initial);
			setWaitLeft(initial);
		}
	}, [emailPrefill, waitParam]);

	useEffect(() => {
		if (waitLeft <= 0) return;
		const t = window.setInterval(() => {
			const email =
				magicEmailRef.current?.value?.trim() || emailPrefill || "";
			const left = readWait(email);
			setWaitLeft(left);
			if (left <= 0) window.clearInterval(t);
		}, 250);
		return () => window.clearInterval(t);
	}, [waitLeft, emailPrefill]);

	async function onMagicSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const fd = new FormData(form);
		const email = String(fd.get("email") || "").trim();
		setOk("");
		setError("");
		setMagicBusy(true);
		try {
			const res = await fetch("/api/auth/magic", {
				method: "POST",
				headers: { Accept: "application/json" },
				body: fd,
			});
			const data = (await res.json().catch(() => ({}))) as {
				error?: string;
				waitSeconds?: number;
			};
			if (!res.ok) {
				if (data.waitSeconds) {
					writeWait(email, data.waitSeconds);
					setWaitLeft(data.waitSeconds);
				} else {
					setError(data.error || "Could not send a magic link.");
				}
				return;
			}
			setOk("Check your email for the magic link.");
			setWaitLeft(0);
		} catch {
			setError("Could not send a magic link. Try again.");
		} finally {
			setMagicBusy(false);
		}
	}

	async function onPasskey() {
		setOk("");
		setError("");
		if (!supabasePublicUrl || !supabaseKey) {
			setError("Passkeys are not configured on this environment.");
			return;
		}
		setPasskeyBusy(true);
		try {
			const supabase = supabaseBrowser(supabasePublicUrl, supabaseKey);
			const auth = supabase.auth as typeof supabase.auth & {
				signInWithPasskey: () => Promise<{
					error: { message: string } | null;
				}>;
			};
			const { error: passkeyError } = await auth.signInWithPasskey();
			if (passkeyError) throw passkeyError;
			window.location.assign(next || "/app");
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Passkey sign-in failed.";
			setError(
				/experimental|not enabled|passkey/i.test(message)
					? "Passkeys are not enabled on this project yet, or this account has none enrolled. Sign in with password, then add a passkey in Settings."
					: message
			);
		} finally {
			setPasskeyBusy(false);
		}
	}

	const waitMessage =
		waitLeft > 0
			? `For security, you can request another magic link in ${waitLeft} second${waitLeft === 1 ? "" : "s"}.`
			: "";

	return (
		<div className="relative w-full md:h-screen md:overflow-hidden">
			<Particles
				className="absolute inset-0"
				color="#666666"
				ease={20}
				quantity={120}
			/>
			<div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-8">
				<Button
					className="absolute top-4 left-4"
					variant="ghost"
					render={<a href="/" />}
					nativeButton={false}
				>
					<ChevronLeftIcon data-icon="inline-start" />
					Home
				</Button>

				<div className="sr-auth mx-auto flex w-full max-w-sm flex-col gap-4">
					<div className="flex items-center gap-2">
						<img
							src="/assets/landing/logo-mark.svg"
							alt=""
							className="h-8 w-auto"
						/>
						<span className="font-medium text-lg">Survey Rocket</span>
					</div>
					<div className="flex flex-col gap-1">
						<h1 className="font-bold text-2xl tracking-wide">
							Welcome back
						</h1>
						<p className="text-base text-muted-foreground">
							Sign in with the password you chose, a magic link, or a
							passkey.
						</p>
					</div>

					<ToggleGroup
						value={[method]}
						onValueChange={(nextValue) => {
							const value = Array.isArray(nextValue)
								? nextValue[0]
								: nextValue;
							if (value === "password" || value === "magic") {
								setMethod(value);
							}
						}}
						variant="outline"
						className="w-full"
						spacing={0}
					>
						<ToggleGroupItem className="flex-1" value="password">
							Password
						</ToggleGroupItem>
						<ToggleGroupItem className="flex-1" value="magic">
							Magic link
						</ToggleGroupItem>
					</ToggleGroup>

					{ok ? <FieldDescription>{ok}</FieldDescription> : null}
					{error ? <FieldError>{error}</FieldError> : null}
					{waitMessage ? (
						<FieldDescription>{waitMessage}</FieldDescription>
					) : null}

					{method === "password" ? (
						<form
							action="/api/auth/password"
							className="flex flex-col gap-4"
							method="post"
							onSubmit={(event) => {
								if (passwordBusyRef.current) {
									event.preventDefault();
									return;
								}
								passwordBusyRef.current = true;
								setPasswordBusy(true);
							}}
						>
							<input name="next" type="hidden" value={next} />
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="password-email">Email</FieldLabel>
									<Input
										id="password-email"
										ref={passwordEmailRef}
										autoComplete="username"
										className="dark:bg-[var(--page)]"
										defaultValue={emailPrefill}
										name="email"
										placeholder="you@company.com"
										required
										type="email"
									/>
								</Field>
								<Field>
									<div className="flex items-baseline justify-between gap-3">
										<FieldLabel htmlFor="password-input">
											Password
										</FieldLabel>
										<Button
											className="h-auto px-0"
											form="reset-form"
											size="sm"
											type="submit"
											variant="link"
											onClick={() => {
												if (
													resetEmailRef.current &&
													passwordEmailRef.current
												) {
													resetEmailRef.current.value =
														passwordEmailRef.current.value;
												}
											}}
										>
											Set or reset password
										</Button>
									</div>
									<InputGroup className="dark:bg-[var(--page)]">
										<InputGroupInput
											id="password-input"
											autoComplete="current-password"
											name="password"
											required
											type={showPassword ? "text" : "password"}
										/>
										<InputGroupAddon align="inline-end">
											<InputGroupButton
												aria-label={
													showPassword ? "Hide password" : "Show password"
												}
												aria-pressed={showPassword}
												size="icon-xs"
												onClick={() => setShowPassword((v) => !v)}
											>
												{showPassword ? <EyeOffIcon /> : <EyeIcon />}
											</InputGroupButton>
										</InputGroupAddon>
									</InputGroup>
								</Field>
							</FieldGroup>
							<Button
								className="sr-auth-submit w-full"
								disabled={passwordBusy}
								loading={passwordBusy}
								type="submit"
							>
								Sign in
							</Button>
						</form>
					) : (
						<form
							className="flex flex-col gap-4"
							onSubmit={onMagicSubmit}
						>
							<input name="next" type="hidden" value={next} />
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="magic-email">Work email</FieldLabel>
									<Input
										id="magic-email"
										ref={magicEmailRef}
										autoComplete="email"
										className="dark:bg-[var(--page)]"
										defaultValue={emailPrefill}
										name="email"
										placeholder="you@company.com"
										required
										type="email"
										onChange={() => {
											const email =
												magicEmailRef.current?.value?.trim() || "";
											setWaitLeft(readWait(email));
										}}
									/>
								</Field>
							</FieldGroup>
							<Button
								className="sr-auth-submit w-full"
								disabled={magicBusy || waitLeft > 0}
								loading={magicBusy}
								type="submit"
							>
								Send magic link
							</Button>
						</form>
					)}

					<form action="/api/auth/reset" hidden id="reset-form" method="post">
						<input name="next" type="hidden" value={next} />
						<input
							id="reset-email"
							ref={resetEmailRef}
							defaultValue={emailPrefill}
							name="email"
							type="hidden"
						/>
					</form>

					<FieldSeparator>Or continue with</FieldSeparator>
					<Button
						className="sr-auth-ghost w-full"
						disabled={passkeyBusy}
						loading={passkeyBusy}
						type="button"
						variant="outline"
						onClick={onPasskey}
					>
						{passkeyBusy ? null : <FingerprintIcon data-icon="inline-start" />}
						Login with passkey
					</Button>
				</div>
			</div>
		</div>
	);
}
