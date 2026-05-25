package worker

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/polyglot-chat/go-service/ent/channel"
	"github.com/polyglot-chat/go-service/ent/channelmessage"
	"github.com/polyglot-chat/go-service/pkg/db"
	"github.com/polyglot-chat/go-service/pkg/logs"
	mediaapi "github.com/polyglot-chat/go-service/pkg/media"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type Service struct {
	messageTTL           time.Duration
	messageSweepInterval time.Duration
	channelInactivity    time.Duration
	channelSweepInterval time.Duration
	mediaSweepInterval   time.Duration
	mediaGracePeriod     time.Duration
}

type conversationRecord struct {
	ID       any    `bson:"_id"`
	MediaURL string `bson:"media_url"`
}

type mediaAssetRecord struct {
	ID         any       `bson:"_id"`
	CID        string    `bson:"cid"`
	GatewayURL string    `bson:"gateway_url"`
	CreatedAt  time.Time `bson:"createdAt"`
}

func NewService() *Service {
	return &Service{
		messageTTL:           envDurationHours("WORKER_MESSAGE_TTL_HOURS", 24),
		messageSweepInterval: envDurationMinutes("WORKER_MESSAGE_SWEEP_MINUTES", 10),
		channelInactivity:    envDurationHours("WORKER_CHANNEL_INACTIVE_HOURS", 24*30),
		channelSweepInterval: envDurationMinutes("WORKER_CHANNEL_SWEEP_MINUTES", 60),
		mediaSweepInterval:   envDurationMinutes("WORKER_MEDIA_SWEEP_MINUTES", 30),
		mediaGracePeriod:     envDurationHours("WORKER_MEDIA_GRACE_HOURS", 1),
	}
}

func (s *Service) Start(ctx context.Context) {
	logs.Info(
		"worker: starting cleanup loops",
		"message_ttl", s.messageTTL.String(),
		"message_interval", s.messageSweepInterval.String(),
		"channel_inactivity", s.channelInactivity.String(),
		"channel_interval", s.channelSweepInterval.String(),
		"media_interval", s.mediaSweepInterval.String(),
		"media_grace", s.mediaGracePeriod.String(),
	)

	go s.runLoop(ctx, "message-ttl", s.messageSweepInterval, s.cleanupExpiredMessages)
	go s.runLoop(ctx, "ghost-channels", s.channelSweepInterval, s.archiveInactiveChannels)
	go s.runLoop(ctx, "media-orphans", s.mediaSweepInterval, s.cleanupOrphanedMedia)
}

func (s *Service) runLoop(ctx context.Context, name string, interval time.Duration, job func(context.Context) error) {
	if interval <= 0 {
		logs.Info("worker: loop disabled", "name", name)
		return
	}

	run := func() {
		jobCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		defer cancel()

		if err := job(jobCtx); err != nil {
			logs.Info("worker: job failed", "name", name, "error", err)
			return
		}

		logs.Info("worker: job completed", "name", name)
	}

	run()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logs.Info("worker: loop stopped", "name", name)
			return
		case <-ticker.C:
			run()
		}
	}
}

func (s *Service) cleanupExpiredMessages(ctx context.Context) error {
	if s.messageTTL <= 0 {
		return nil
	}

	cutoff := time.Now().Add(-s.messageTTL)
	collection := db.MongoDatabase.Collection("conversations")

	result, err := collection.DeleteMany(ctx, bson.M{
		"createdAt": bson.M{"$lte": cutoff},
	})
	if err != nil {
		return fmt.Errorf("cleanupExpiredMessages delete: %w", err)
	}

	logs.Info("worker: expired messages cleaned", "deleted", result.DeletedCount, "cutoff", cutoff.Format(time.RFC3339))
	return nil
}

func (s *Service) archiveInactiveChannels(ctx context.Context) error {
	if s.channelInactivity <= 0 {
		return nil
	}

	cutoff := time.Now().Add(-s.channelInactivity)

	channels, err := db.Client.Channel.
		Query().
		Where(
			channel.ArchivedAtIsNil(),
			channel.LastActivityAtLTE(cutoff),
		).
		All(ctx)
	if err != nil {
		return fmt.Errorf("archiveInactiveChannels query: %w", err)
	}

	if len(channels) == 0 {
		logs.Info("worker: no inactive channels to archive", "cutoff", cutoff.Format(time.RFC3339))
		return nil
	}

	for _, ch := range channels {
		if err := db.Client.Channel.UpdateOneID(ch.ID).
			SetArchivedAt(time.Now()).
			Exec(ctx); err != nil {
			return fmt.Errorf("archiveInactiveChannels update %s: %w", ch.ID.String(), err)
		}

		logs.Info(
			"worker: archived inactive channel",
			"channel_id", ch.ID.String(),
			"name", ch.Name,
			"last_activity_at", ch.LastActivityAt.Format(time.RFC3339),
		)
	}

	return nil
}

func (s *Service) cleanupOrphanedMedia(ctx context.Context) error {
	collection := db.MongoDatabase.Collection("media_assets")
	cutoff := time.Now().Add(-s.mediaGracePeriod)

	cursor, err := collection.Find(ctx, bson.M{
		"createdAt": bson.M{"$lte": cutoff},
	})
	if err != nil {
		return fmt.Errorf("cleanupOrphanedMedia find: %w", err)
	}
	defer cursor.Close(ctx)

	var assets []mediaAssetRecord
	if err := cursor.All(ctx, &assets); err != nil {
		return fmt.Errorf("cleanupOrphanedMedia decode: %w", err)
	}

	var cleaned int
	for _, asset := range assets {
		inUse, err := s.mediaAssetInUse(ctx, asset.GatewayURL)
		if err != nil {
			return err
		}
		if inUse {
			continue
		}

		if asset.CID != "" {
			if err := mediaapi.Unpin(ctx, asset.CID); err != nil {
				return fmt.Errorf("cleanupOrphanedMedia unpin %s: %w", asset.CID, err)
			}
		}

		if _, err := collection.DeleteOne(ctx, bson.M{"_id": asset.ID}); err != nil {
			return fmt.Errorf("cleanupOrphanedMedia delete asset doc: %w", err)
		}

		cleaned++
		logs.Info("worker: removed orphaned media", "cid", asset.CID, "gateway_url", asset.GatewayURL)
	}

	logs.Info("worker: media cleanup complete", "scanned", len(assets), "removed", cleaned)
	return nil
}

func (s *Service) mediaAssetInUse(ctx context.Context, gatewayURL string) (bool, error) {
	if gatewayURL == "" {
		return false, nil
	}

	conversations := db.MongoDatabase.Collection("conversations")
	count, err := conversations.CountDocuments(ctx, bson.M{"media_url": gatewayURL})
	if err != nil {
		return false, fmt.Errorf("mediaAssetInUse conversations: %w", err)
	}
	if count > 0 {
		return true, nil
	}

	exists, err := db.Client.ChannelMessage.
		Query().
		Where(channelmessage.MediaURL(gatewayURL)).
		Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("mediaAssetInUse channel messages: %w", err)
	}

	return exists, nil
}

func envDurationMinutes(key string, fallback int) time.Duration {
	return time.Duration(envInt(key, fallback)) * time.Minute
}

func envDurationHours(key string, fallback int) time.Duration {
	return time.Duration(envInt(key, fallback)) * time.Hour
}

func envInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
