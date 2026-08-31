import { Friendship } from "../models/Friendship.js";

export const sendFriendRequest = async (req, res) => {
  const requesterId = req.user.id;
  const { recipientId } = req.body;

  if (requesterId === recipientId) {
    return res
      .status(400)
      .json({ message: "You cannot send a friend request to yourself." });
  }

  // Check existing relationship in either direction
  const existing = await Friendship.findOne({
    $or: [
      { requester: requesterId, recipient: recipientId },
      { requester: recipientId, recipient: requesterId },
    ],
  });

  if (existing) {
    return res.status(400).json({
      message: `Relationship already exists with status: ${existing.status}`,
    });
  }

  const friendship = await Friendship.create({
    requester: requesterId,
    recipient: recipientId,
    status: "PENDING",
  });

  return res.status(201).json({ success: true, friendship });
};

// Respond to Request (ACCEPT, REJECT, or BLOCK)
export const respondToRequest = async (req, res) => {
  const userId = req.user.id;
  const { requestId, action } = req.body; // action: 'ACCEPT' | 'REJECT' | 'BLOCK'

  const friendship = await Friendship.findById(requestId);
  if (!friendship) {
    return res.status(404).json({ message: "Friend request not found." });
  }

  // Only recipient can accept/reject a pending request
  if (friendship.recipient.toString() !== userId) {
    return res
      .status(403)
      .json({ message: "Unauthorized to respond to this request." });
  }

  if (action === "ACCEPT") {
    friendship.status = "ACCEPTED";
    await friendship.save();
    return res.json({ success: true, message: "Friend request accepted." });
  }

  if (action === "REJECT") {
    await Friendship.findByIdAndDelete(requestId);
    return res.json({ success: true, message: "Friend request rejected." });
  }

  if (action === "BLOCK") {
    friendship.status = "BLOCKED";
    await friendship.save();
    return res.json({ success: true, message: "User blocked." });
  }

  return res.status(400).json({ message: "Invalid action." });
};

// Get Confirmed Friends List
export const getFriends = async (req, res) => {
  const userId = req.user.id;

  const friendships = await Friendship.find({
    status: "ACCEPTED",
    $or: [{ requester: userId }, { recipient: userId }],
  })
    .populate("requester", "username avatar rank mmr")
    .populate("recipient", "username avatar rank mmr");

  // Extract friend object relative to logged-in user
  const friends = friendships.map((f) => {
    const friend =
      f.requester._id.toString() === userId ? f.recipient : f.requester;
    return {
      friendshipId: f._id,
      ...friend.toObject(),
    };
  });

  return res.json({ success: true, friends });
};

// Get Incoming & Outgoing Pending Requests
export const getPendingRequests = async (req, res) => {
  const userId = req.user.id;
  const incoming = await Friendship.find({
    recipient: userId,
    status: "PENDING",
  }).populate("requester", "username avatar rank");
  const outgoing = await Friendship.find({
    requester: userId,
    status: "PENDING",
  }).populate("recipient", "username avatar rank");
  return res.json({ success: true, incoming, outgoing });
};


export const removeFriend = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;

    // Delete friendship where either user is the requester and the other is recipient
    const result = await Friendship.findOneAndDelete({
      $or: [
        { requester: userId, recipient: friendId },
        { requester: friendId, recipient: userId },
      ],
      status: 'ACCEPTED',
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Active friendship record not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Friend removed successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while removing friend.',
      error: error.message,
    });
  }
};