package channels

import (
	"context"
	"fmt"

	"github.com/polyglot-chat/go-service/pkg/db"
	"github.com/polyglot-chat/go-service/pkg/logs"
)

func trackChannelPresence(ctx context.Context, channelID, userID string, online bool) {
	channelKey := fmt.Sprintf("channel_presence:%s", channelID)
	activeChannelsKey := "active_channels"

	if online {
		if err := db.Redis.SAdd(ctx, channelKey, userID).Err(); err != nil {
			logs.Info("channel presence: add user failed", "channel_id", channelID, "user_id", userID, "error", err)
			return
		}
		if err := db.Redis.SAdd(ctx, activeChannelsKey, channelID).Err(); err != nil {
			logs.Info("channel presence: mark active channel failed", "channel_id", channelID, "error", err)
			return
		}
		logs.Info("channel presence: user online", "channel_id", channelID, "user_id", userID)
		return
	}

	if err := db.Redis.SRem(ctx, channelKey, userID).Err(); err != nil {
		logs.Info("channel presence: remove user failed", "channel_id", channelID, "user_id", userID, "error", err)
		return
	}

	count, err := db.Redis.SCard(ctx, channelKey).Result()
	if err != nil {
		logs.Info("channel presence: count users failed", "channel_id", channelID, "error", err)
		return
	}
	if count == 0 {
		if err := db.Redis.Del(ctx, channelKey).Err(); err != nil {
			logs.Info("channel presence: delete empty channel set failed", "channel_id", channelID, "error", err)
			return
		}
		if err := db.Redis.SRem(ctx, activeChannelsKey, channelID).Err(); err != nil {
			logs.Info("channel presence: remove active channel failed", "channel_id", channelID, "error", err)
			return
		}
	}

	logs.Info("channel presence: user offline", "channel_id", channelID, "user_id", userID, "remaining", count)
}
