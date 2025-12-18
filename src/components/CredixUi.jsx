import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Wallet,
  Calendar,
  TrendingUp,
  Gift,
  History,
} from "lucide-react";

export default function CredixUi() {
  const [bills, setBills] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [error, setError] = useState(null);

  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // Fetch Bills, Payments, Rewards
  useEffect(() => {
    fetch(apiBase + "/api/bills")
      .then((res) => res.json())
      .then(setBills)
      .catch(() => setError("Failed to load bills"));

    fetch(apiBase + "/api/payments")
      .then((res) => res.json())
      .then(setPaymentHistory)
      .catch(() => setError("Failed to load payments"));

    fetch(apiBase + "/api/rewards")
      .then((res) => res.json())
      .then(setRewards)
      .catch(() => setError("Failed to load rewards"));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-4xl font-bold mb-6 text-purple-400">
        Credix Dashboard
      </h1>

      {error && (
        <p className="text-red-400 bg-red-900/20 p-3 rounded mb-4">{error}</p>
      )}

      {/* **************   BILLS SECTION   ************** */}
      <section className="mb-10">
        <div className="bg-purple-900/20 p-4 rounded-lg flex items-center gap-3 mb-4">
          <Wallet className="text-purple-300" />
          <h2 className="text-2xl font-semibold">Upcoming Bills</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bills.length === 0 ? (
            <p className="text-gray-400">No bills found</p>
          ) : (
            bills.map((bill) => (
              <div
                key={bill.id || bill._id}
                className="p-4 rounded-lg border border-purple-700 bg-purple-950/20"
              >
                <h3 className="text-xl font-bold">{bill.name}</h3>
                <p className="text-purple-300">{bill.bank}</p>
                <p className="text-gray-300">Amount: ₹{bill.amount}</p>
                <p className="text-gray-400">
                  Due Date: {new Date(bill.dueDate).toDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* **************   PAYMENT HISTORY SECTION   ************** */}
      <section className="mb-10">
        <div className="bg-purple-900/20 p-4 rounded-lg flex items-center gap-3 mb-4">
          <History className="text-purple-300" />
          <h2 className="text-2xl font-semibold">Payment History</h2>
        </div>

        {paymentHistory.length === 0 ? (
          <p className="text-gray-400">No payment history available</p>
        ) : (
          <div className="space-y-3">
            {paymentHistory.map((payment) => (
              <div
                key={payment.id || payment._id}
                className="p-4 rounded-lg border border-purple-700 bg-purple-950/20"
              >
                <p className="text-lg font-bold">{payment.bank}</p>
                <p className="text-gray-300">Amount: ₹{payment.amount}</p>
                <p className="text-gray-400">
                  Date: {new Date(payment.date).toDateString()}
                </p>
                <p className="text-purple-300">
                  Coins Earned: {payment.coins}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* **************   REWARDS SECTION   ************** */}
      <section>
        <div className="bg-purple-900/20 p-4 rounded-lg flex items-center gap-3 mb-4">
          <Gift className="text-purple-300" />
          <h2 className="text-2xl font-semibold">Rewards</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rewards.length === 0 ? (
            <p className="text-gray-400">No rewards available</p>
          ) : (
            rewards.map((reward) => (
              <div
                key={reward.id || reward._id}
                className="p-4 rounded-lg border border-purple-700 bg-purple-950/20"
              >
                <h3 className="text-xl font-bold mb-2">{reward.title}</h3>
                <p className="text-purple-300">Coins: {reward.coins}</p>
                <p className="text-gray-300">{reward.discount}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}






