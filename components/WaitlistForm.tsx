// "use client";

// import { useState, FormEvent } from 'react';

// export default function WaitlistForm() {
//   const [email, setEmail] = useState('');
//   const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
//   const [message, setMessage] = useState('');

//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setStatus('loading');
//     setMessage('');

//     try {
//       const response = await fetch('/api/waitlist', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ email }),
//       });

//       const data = await response.json();

//       if (response.ok) {
//         setStatus('success');
//         setMessage(data.message || 'Successfully added to waitlist!');
//         setEmail(''); // Clear the form
//       } else {
//         setStatus('error');
//         setMessage(data.error || 'Something went wrong. Please try again.');
//       }
//     } catch (error) {
//       setStatus('error');
//       setMessage('Network error. Please check your connection and try again. Or maybe the code broke again.');
//     }
//   };

//   return (
//     <div className="w-full">
//       <form
//         onSubmit={handleSubmit}
//         className="mt-8 flex flex-col sm:flex-row gap-4 max-w-xl mx-auto"
//       >
//         <div className="flex-1 relative">
//           <input
//             type="email"
//             placeholder="Enter your email"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//             disabled={status === 'loading'}
//             className="w-full px-6 py-4 rounded-2xl border-2 border-background/30 bg-background/20 backdrop-blur-sm text-background text-lg focus:ring-4 focus:ring-background/40 focus:border-background/60 outline-none placeholder:text-background/60 transition-all duration-300 hover:border-background/50 disabled:opacity-50 disabled:cursor-not-allowed"
//           />
//           {status === 'success' && (
//             <div className="absolute right-4 top-1/2 -translate-y-1/2">
//               <svg className="w-6 h-6 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
//               </svg>
//             </div>
//           )}
//         </div>
//         <button
//           type="submit"
//           disabled={status === 'loading' || status === 'success'}
//           className="px-8 py-4 bg-background text-accent font-semibold text-lg rounded-2xl hover:bg-background/90 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 hover:scale-105 border-2 border-background/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100"
//         >
//           {status === 'loading' ? (
//             <span className="flex items-center gap-2">
//               <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//               </svg>
//               Joining...
//             </span>
//           ) : status === 'success' ? (
//             'Joined!'
//           ) : (
//             'Join Waitlist'
//           )}
//         </button>
//       </form>

//       {message && (
//   <div
//     role="status"
//     aria-live="polite"
//     className={`mt-4 max-w-xl mx-auto px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
//       status === 'success'
//         ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40'
//         : 'bg-red-500/10 text-red-200 border border-red-500/40'
//     }`}
//   >
//     {status === 'success' ? (
//       <svg
//         className="w-5 h-5 text-emerald-300"
//         fill="none"
//         stroke="currentColor"
//         viewBox="0 0 24 24"
//       >
//         <path
//           strokeLinecap="round"
//           strokeLinejoin="round"
//           strokeWidth={2}
//           d="M5 13l4 4L19 7"
//         />
//       </svg>
//     ) : (
//       <svg
//         className="w-5 h-5 text-red-300"
//         fill="none"
//         stroke="currentColor"
//         viewBox="0 0 24 24"
//       >
//         <path
//           strokeLinecap="round"
//           strokeLinejoin="round"
//           strokeWidth={2}
//           d="M12 9v4m0 4h.01M12 5a7 7 0 100 14 7 7 0 000-14z"
//         />
//       </svg>
//     )}
//     <p>{message}</p>
//   </div>
// )}

//     </div>
//   );
// }

"use client";

import { useEffect, useState, FormEvent } from "react";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false); // controls fade

  useEffect(() => {
    if (status === "success" || status === "error") {
      setShowMessage(true);

      const timer = setTimeout(() => {
        // fade out first
        setShowMessage(false);

        // then clear state after fade duration (300ms here)
        setTimeout(() => {
          setStatus("idle");
          setMessage("");
        }, 300);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    setShowMessage(false);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message || "Successfully added to waitlist!");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        "Network error. Please check your connection and try again. Or maybe the code broke again.",
      );
    }
  };

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="mt-8 flex flex-col sm:flex-row gap-4 max-w-xl mx-auto"
      >
        <div className="flex-1 relative">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === "loading"}
            className="w-full px-6 py-4 rounded-2xl border-2 border-background/30 bg-background/20 backdrop-blur-sm text-background text-lg focus:ring-4 focus:ring-background/40 focus:border-background/60 outline-none placeholder:text-background/60 transition-all duration-300 hover:border-background/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {status === "success" && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <svg
                className="w-6 h-6 text-background"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="px-8 py-4 bg-background text-accent font-semibold text-lg rounded-2xl hover:bg-background/90 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 hover:scale-105 border-2 border-background/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100"
        >
          {status === "loading" ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Joining...
            </span>
          ) : status === "success" ? (
            "Joined!"
          ) : (
            "Join Waitlist"
          )}
        </button>
      </form>

      {/* Reserved height so layout doesn't jump */}
      <div className="mt-4 min-h-[3rem] flex items-start justify-center">
        {message && (
          <div
            role="status"
            aria-live="polite"
            className={`max-w-xl px-4 py-3 rounded-xl text-sm flex items-center gap-2 transition-opacity duration-300 ${
              showMessage ? "opacity-100" : "opacity-0"
            } ${
              status === "success"
                ? "bg-emerald-500/10 text-emerald-200 border border-emerald-500/40"
                : "bg-red-500/10 text-red-200 border border-red-500/40"
            }`}
          >
            {status === "success" ? (
              <svg
                className="w-5 h-5 text-emerald-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-red-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v4m0 4h.01M12 5a7 7 0 100 14 7 7 0 000-14z"
                />
              </svg>
            )}
            <p>{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
