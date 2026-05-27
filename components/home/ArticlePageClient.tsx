"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import type { Database } from "@/types/database";
import ArticleHeader from "./ArticleHeader";
import ArticleContent from "./ArticleContent";
import EmailWall from "./EmailWall";
import OnboardingOverlay from "@/components/onboarding/OnboardingOverlay";
import { getNeighborhoodCookie, setNeighborhoodCookie, setFullAccessCookie, getFullAccessCookie } from "@/lib/cookies";

type Neighborhood = Database["public"]["Tables"]["neighborhoods"]["Row"];
type NewsletterIssue = Database["public"]["Tables"]["newsletter_issues"]["Row"];

interface Props {
  defaultNeighborhood: Neighborhood;
  allNeighborhoods: Neighborhood[];
  featuredIssue: NewsletterIssue | null;
  isLoggedIn: boolean;
  showOnboarding: boolean;
}

export default function ArticlePageClient({
  defaultNeighborhood,
  allNeighborhoods,
  featuredIssue: initialFeaturedIssue,
  isLoggedIn,
  showOnboarding: initialShowOnboarding,
}: Props) {
  const router = useRouter();

  // ── State ────────────────────────────────────────────────────────────────
  const [currentNeighborhood, setCurrentNeighborhood] = useState(defaultNeighborhood);
  const [featuredIssue, setFeaturedIssue] = useState(initialFeaturedIssue);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);

  // Paywall state
  const [showEmailWall, setShowEmailWall] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);

  // Onboarding overlay — only show post-magic-link (requires being logged in)
  const [showOnboarding, setShowOnboarding] = useState(initialShowOnboarding && isLoggedIn);

  // Email submitted — waiting for magic link click
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  // ── On mount: check cookies ───────────────────────────────────────────────
  useEffect(() => {
    // Full access cookie (they previously dismissed or completed onboarding)
    if (getFullAccessCookie() || isLoggedIn) {
      setHasFullAccess(true);
    }

    // Remember their neighborhood preference
    const savedSlug = getNeighborhoodCookie();
    if (savedSlug && savedSlug !== currentNeighborhood.slug) {
      const saved = allNeighborhoods.find((n) => n.slug === savedSlug);
      if (saved) switchNeighborhood(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Neighborhood switch (client-side fetch) ───────────────────────────────
  const switchNeighborhood = useCallback(async (hood: Neighborhood) => {
    setCurrentNeighborhood(hood);
    setIsLoadingArticle(true);

    try {
      const res = await fetch(`/api/featured-article?neighborhoodId=${hood.id}`);
      const data = await res.json();
      setFeaturedIssue(data.issue ?? null);
    } catch {
      setFeaturedIssue(null);
    } finally {
      setIsLoadingArticle(false);
    }

    // Update URL (no reload)
    router.replace(`/?n=${hood.slug}`, { scroll: false });
  }, [router]);

  // ── Paywall trigger: show email wall after 20 seconds ───────────────────
  useEffect(() => {
    if (hasFullAccess || emailSubmitted) return;
    const timer = setTimeout(() => setShowEmailWall(true), 20_000);
    return () => clearTimeout(timer);
  }, [hasFullAccess, emailSubmitted]);

  // ── Sign Up button in header: same as hitting the paywall ────────────────
  const handleSignUpClick = useCallback(() => {
    if (!hasFullAccess && !isLoggedIn) {
      setShowEmailWall(true);
    }
  }, [hasFullAccess, isLoggedIn]);

  // ── Email wall: user submitted email ────────────────────────────────────────
  const handleEmailSubmit = useCallback((email: string) => {
    // Save neighborhood for analytics even without full sign-up
    setNeighborhoodCookie(currentNeighborhood.slug);
    setEmailSubmitted(true);
    setShowEmailWall(false);
    // signInWithOtp is called inside EmailWall component
    // It redirects back to /?show=onboarding after magic link click
    void email; // used by EmailWall
  }, [currentNeighborhood.slug]);

  // ── Onboarding overlay: user pressed X ───────────────────────────────────
  const handleOnboardingDismiss = useCallback(() => {
    setShowOnboarding(false);
    setHasFullAccess(true);
    // Save neighborhood + full access cookies
    setNeighborhoodCookie(currentNeighborhood.slug);
    setFullAccessCookie();
    // Clean up URL
    router.replace(`/?n=${currentNeighborhood.slug}`, { scroll: false });
  }, [currentNeighborhood.slug, router]);

  // ── Onboarding overlay: user completed sign-up ────────────────────────────
  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    setHasFullAccess(true);
    setFullAccessCookie();
    router.replace(`/?n=${currentNeighborhood.slug}`, { scroll: false });
  }, [currentNeighborhood.slug, router]);

  // ── Email wall: user closed without submitting ────────────────────────────
  const handleWallClose = useCallback(() => {
    setShowEmailWall(false);
  }, []);

  return (
    <div className="min-h-screen-safe bg-white">
      {/* Sticky top header with neighborhood selector */}
      <ArticleHeader
        currentNeighborhood={currentNeighborhood}
        allNeighborhoods={allNeighborhoods}
        onNeighborhoodChange={switchNeighborhood}
        isLoggedIn={isLoggedIn}
        onSignUp={handleSignUpClick}
      />

      {/* Article body */}
      <ArticleContent
        neighborhood={currentNeighborhood}
        issue={featuredIssue}
        isLoading={isLoadingArticle}
      />

      {/* Email wall modal */}
      <AnimatePresence>
        {showEmailWall && (
          <EmailWall
            neighborhoodName={currentNeighborhood.name}
            onEmailSubmit={handleEmailSubmit}
            onClose={handleWallClose}
            neighborhoodSlug={currentNeighborhood.slug}
          />
        )}
      </AnimatePresence>

      {/* Onboarding overlay (shown after magic link click) */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingOverlay
            onDismiss={handleOnboardingDismiss}
            onComplete={handleOnboardingComplete}
            defaultNeighborhoodId={currentNeighborhood.id}
            defaultNeighborhoodName={currentNeighborhood.name}
          />
        )}
      </AnimatePresence>

      {/* Email submitted state — waiting for link (dismiss only closes banner, no access granted) */}
      <AnimatePresence>
        {emailSubmitted && !showOnboarding && (
          <MagicLinkSentBanner onDismiss={() => setEmailSubmitted(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Small banner shown after email submit ─────────────────────────────────────
import { motion } from "framer-motion";

function MagicLinkSentBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 p-4"
    >
      <div className="max-w-lg mx-auto bg-gs-dark text-white rounded-3xl p-4 flex items-center gap-3 shadow-xl">
        <span className="text-2xl">📬</span>
        <div className="flex-1">
          <p className="font-bold text-sm">Check your inbox!</p>
          <p className="text-white/70 text-xs">Click the link we sent to get full access.</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-white/60 hover:text-white text-sm font-semibold"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}
