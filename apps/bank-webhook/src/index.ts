import express from "express";
import db from "@repo/db/client";
const app = express();

app.use(express.json());

app.post("/hdfcWebhook", async (req, res) => {
  //TODO: HDFC bank should ideally send us a secret so we know this is sent by them
  const paymentInformation: {
    token: string;
    userId: string;
    amount: string;
  } = {
    token: req.body.token,
    userId: req.body.user_identifier,
    amount: req.body.amount,
  };

  try {
    await db.$transaction(async (tx) => {
      // Check if the balance record exists
      const balanceRecord = await tx.balance.findUnique({
        where: {
          userId: Number(paymentInformation.userId),
        },
      });

      if (balanceRecord) {
        // Update the user's balance if it exists
        await tx.balance.update({
          where: {
            userId: Number(paymentInformation.userId),
          },
          data: {
            amount: {
              increment: Number(paymentInformation.amount),
            },
          },
        });
      } else {
        // Create a new balance record if it does not exist
        await tx.balance.create({
          data: {
            userId: Number(paymentInformation.userId),
            amount: Number(paymentInformation.amount),
            locked: 0,
          },
        });
      }

      // Update the transaction status
      await tx.onRampTransaction.update({
        where: {
          token: paymentInformation.token,
        },
        data: {
          status: "Success",
        },
      });
    });

    res.json({
      message: "Captured",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Error while processing webhook",
    });
  }
});

app.listen(3003);
