const messageGenarator = (
  method,
  number,
  chargee,
  amount,
  trxid,
  date,
  time,
  oldBalance,
  rcvrOldBalance,
  rcvrNumber
) => {
  const charge = parseFloat(chargee.toFixed(2));
  switch (method) {
    case "cash_out":
      return {
        senderMessage: `Cash Out Tk ${amount} to ${rcvrNumber} successful. Fee Tk ${charge}. Balance Tk ${(
          parseFloat(oldBalance) -
          (parseFloat(amount) + charge)
        ).toFixed(2)}. TrxID ${trxid} at ${time},${date} .`,
        receiverMessage: `You have received Tk ${amount} from ${number}.Fee Tk ${charge}. Balance Tk ${
          parseFloat(rcvrOldBalance) + parseFloat(amount).toFixed(2)
        }. TrxID ${trxid} at${time},${date} .`,
      };

    case "send_money":
      return {
        senderMessage: `You sent Tk ${amount} to ${number}. Fee Tk ${charge}. Balance Tk ${
          parseFloat(oldBalance) - (parseFloat(amount) + charge).toFixed(2)
        }. TrxID ${trxid} at ${date} ${time}.`,
        receiverMessage: `You have received Tk ${amount} from ${number}. Fee Tk ${charge}. Balance Tk ${
          parseFloat(rcvrOldBalance) + parseFloat(amount).toFixed(2)
        }. TrxID ${trxid} at ${date} ${time}.`,
      };

    case "payment":
      return {
        senderMessage: `Payment Tk ${amount} to ${number} is successful. Balance Tk ${(
          parseFloat(oldBalance) -
          (parseFloat(amount) + charge)
        ).toFixed(2)}. TrxID ${trxid} at ${date} ${time}.`,
        receiverMessage: `You have received a payment of Tk ${amount} from ${number} . TrxID ${trxid} at ${date} ${time}.`,
      };

    case "withdraw_money":
      return {
        senderMessage: `Withdraw request of Tk ${amount} to Admin has been successful. You will be notified once processed. TrxID ${trxid} at ${date} ${time}.`,
        receiverMessage: `You have received a withdraw request Tk ${amount} from ${number}.TrxID ${trxid} at ${date} ${time}.`,
      };
    case "deposit_money":
      return {
        receiverMessage: `Deposit request of Tk ${amount} to Admin submitted successfully.TrxID ${trxid} at ${date} ${time}.`,
        senderMessage: `Deposit request of Tk ${amount} from ${number} has been received. TrxID ${trxid} at ${date} ${time}.`,
      };
    case "cash_in":
      return {
        receiverMessage: `Cash In request of Tk ${amount} to ${number} has been submitted. You will receive an update once processed. TrxID ${trxid} at ${date} ${time}.`,
        senderMessage: `You have received a Cash In request for Tk ${amount} from ${rcvrNumber}. TrxID ${trxid} at ${date} ${time}.`,
      };
  }
};
module.exports = { messageGenarator };
