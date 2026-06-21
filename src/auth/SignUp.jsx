// src/SignUp.jsx
import { useState } from "react";
import { useAuth } from "./AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(email, password);
      navigate("/"); // login తర్వాత main page
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-purple-900/40 border border-purple-700 rounded-2xl p-6 w-full max-w-sm"
      >
        <h2 className="text-xl font-bold mb-4 text-purple-200">Sign Up</h2>

        {error && <p className="mb-3 text-red-400 text-sm">{error}</p>}

        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          className="w-full mb-3 rounded-lg px-3 py-2 bg-black/60 border border-purple-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          className="w-full mb-4 rounded-lg px-3 py-2 bg-black/60 border border-purple-700"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-500 rounded-lg py-2 font-semibold"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>

        <p className="text-xs text-gray-300 mt-3">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-300 underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
