"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Send, DollarSign } from "lucide-react";
import { GradientAvatar } from "@/lib/gradient-avatar";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CHAIN_ID, BLOCK_EXPLORER_URL } from "@/lib/constants";

interface SendPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: {
    id: string;
    displayName: string;
    username: string;
    smartAccountAddress: string;
  };
}

export function SendPaymentModal({
  isOpen,
  onClose,
  recipient,
}: SendPaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and one decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleSendPayment = async () => {
    setIsSending(true);

    try {
      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        toast.error("Invalid amount", {
          description: "Please enter a valid amount greater than $0",
        });
        return;
      }

      // Send payment via server-side API
      const response = await fetch("/api/wallet/send-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientUserId: recipient.id,
          amount: amount,
          message: message,
          chainId: CHAIN_ID,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send payment");
      }

      const { transactionHash } = await response.json();

      // Invalidate queries to refresh transaction lists and balance
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "balance"] });

      // Close modal and reset form first
      setAmount("");
      setMessage("");
      onClose();

      // Show celebratory toast with transaction details
      toast.success("Payment sent!", {
        description: `$${amount} sent to ${recipient.displayName}`,
        duration: 6000,
        action: transactionHash
          ? {
              label: "View Receipt",
              onClick: () =>
                window.open(
                  `${BLOCK_EXPLORER_URL}/tx/${transactionHash}`,
                  "_blank"
                ),
            }
          : undefined,
        className: "success-toast",
        style: {
          background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
          color: "white",
          border: "none",
          minHeight: "70px",
          padding: "16px",
        },
      });

      // Navigate to home to see the transaction in the feed
      router.push("/");
    } catch (error) {
      toast.error("Payment failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        duration: 5000,
      });
    } finally {
      setIsSending(false);
    }
  };

  const isValidAmount = amount && parseFloat(amount) > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Info */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <GradientAvatar
              username={recipient.username}
              name={recipient.displayName}
              size="lg"
            />
            <div>
              <h3 className="font-semibold">{recipient.displayName}</h3>
              <p className="text-sm text-muted-foreground">
                @{recipient.username}
              </p>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                className="pl-10 text-lg"
                disabled={isSending}
              />
            </div>
            {amount && parseFloat(amount) <= 0 && (
              <p className="text-sm text-destructive">
                Amount must be greater than $0
              </p>
            )}
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a note to your payment..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/500 characters
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendPayment}
              className="flex-1"
              disabled={!isValidAmount || isSending}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSending ? "Sending..." : "Send Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
