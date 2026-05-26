"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Database } from "@/types/database";

type Neighborhood = Database["public"]["Tables"]["neighborhoods"]["Row"];

interface Props {
  currentNeighborhood: Neighborhood;
  allNeighborhoods: Neighborhood[];
  onNeighborhoodChange: (hood: Neighborhood) => void;
  isLoggedIn: boolean;
  onSignUp: () => void;
}

export default function ArticleHeader({
  currentNeighborhood,
  allNeighborhoods,
  onNeighborhoodChange,
  isLoggedIn,
  onSignUp,
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gs-border">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

        {/* Left: Neighborhood selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 bg-gs-surface border border-gs-border rounded-full px-3 py-1.5 tap-none hover:border-gs-red/40 transition-colors max-w-[200px] sm:max-w-xs"
            aria-label="Change neighborhood"
          >
            <span className="text-xs font-black text-gs-dark truncate">
              {currentNeighborhood.name}
            </span>
            <ChevronIcon open={dropdownOpen} />
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl border border-gs-border shadow-xl overflow-hidden z-50"
              >
                <div className="p-2">
                  <p className="text-xs text-gs-medium font-semibold uppercase tracking-wider px-3 py-2">
                    Choose neighborhood
                  </p>
                  {allNeighborhoods.map((hood) => (
                    <button
                      key={hood.id}
                      onClick={() => {
                        onNeighborhoodChange(hood);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors tap-none ${
                        hood.id === currentNeighborhood.id
                          ? "bg-accent text-gs-red"
                          : "text-gs-dark hover:bg-gs-surface"
                      }`}
                    >
                      {hood.name}
                      <span className="block text-xs font-normal text-gs-medium">
                        {hood.city}, {hood.state}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center: Logo */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gs-red flex items-center justify-center">
            <span className="text-white text-xs font-black">G</span>
          </div>
          <span className="text-sm font-black text-gs-dark hidden sm:block">Gild Society</span>
        </div>

        {/* Right: Sign in / account */}
        <div className="flex items-center">
          {isLoggedIn ? (
            <a
              href="/account"
              className="text-xs font-semibold text-gs-medium hover:text-gs-red transition-colors tap-none"
            >
              My account
            </a>
          ) : (
            <button
              onClick={onSignUp}
              className="text-xs font-semibold text-gs-red border border-gs-red rounded-full px-3 py-1.5 hover:bg-accent transition-colors tap-none"
            >
              Sign up
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <motion.svg
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.2 }}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#767676"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      <path d="M6 9l6 6 6-6" />
    </motion.svg>
  );
}
