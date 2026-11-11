require "minitest/autorun"
require "fastlane"

Fastlane.load_actions
Fastlane::FastFile.new.parse(File.read(File.join(__dir__, "Fastfile")))

class ScreenshotSyncTest < Minitest::Test
  Screenshot = Struct.new(:id, :file_name, :state, :deleted) do
    def asset_delivery_state
      { "state" => state }
    end

    def error?
      state == "FAILED"
    end

    def delete!
      self.deleted = true
    end
  end

  class Iterator
    attr_accessor :screenshots

    def initialize(screenshots)
      @screenshots = screenshots
    end

    def each_app_screenshot
      return enum_for(__method__) unless block_given?

      screenshots.reject(&:deleted).each { |screenshot| yield(nil, nil, screenshot) }
    end
  end

  class Sync < Deliver::SyncScreenshots
    attr_reader :elapsed, :replacement_passes, :sleeps
    attr_accessor :on_sleep, :on_replace

    def initialize
      super(app: nil, platform: "ios")
      @elapsed = 0
      @replacement_passes = 0
      @sleeps = []
    end

    def do_replace_screenshots(iterator, screenshots, delete_worker, upload_worker)
      @replacement_passes += 1
      on_replace&.call(iterator, replacement_passes)
    end

    def create_delete_worker; end
    def create_upload_worker; end

    def screenshot_processing_time
      elapsed
    end

    def sleep(seconds)
      @sleeps << seconds
      @elapsed += seconds
      # Fail fast if the real polling code never reaches its recovery path.
      raise Timeout::Error, "Screenshot processing did not retry within five minutes" if elapsed > replacement_passes * 300

      on_sleep&.call
    end
  end

  def setup
    @complete = Screenshot.new("complete", "1_party.png", "COMPLETE", false)
    @stuck = Screenshot.new("stuck", "2_balances.png", "UPLOAD_COMPLETE", false)
    @iterator = Iterator.new([@complete, @stuck])
    @sync = Sync.new
  end

  def test_retries_only_stuck_screenshots_after_processing_deadline
    replacement = Screenshot.new("replacement", "2_balances.png", "COMPLETE", false)
    @sync.on_replace = lambda do |iterator, pass|
      iterator.screenshots << replacement if pass == 2
    end

    @sync.replace_screenshots(@iterator, ["1_party.png", "2_balances.png"])

    assert @stuck.deleted
    refute @complete.deleted
    refute replacement.deleted
    assert_equal 2, @sync.replacement_passes
    assert_equal 300, @sync.elapsed
    assert @sync.sleeps.all? { |seconds| seconds <= 30 }
  end

  def test_processing_that_finishes_during_polling_does_not_reupload
    @sync.on_sleep = -> { @stuck.state = "COMPLETE" }

    @sync.replace_screenshots(@iterator, ["1_party.png", "2_balances.png"])

    assert_equal 1, @sync.replacement_passes
    refute @stuck.deleted
    refute @complete.deleted
  end

  def test_recovers_the_release_snapshot_with_69_complete_and_three_stuck
    complete = Array.new(69) { |i| Screenshot.new("complete-#{i}", "complete-#{i}.png", "COMPLETE", false) }
    stuck = Array.new(3) { |i| Screenshot.new("stuck-#{i}", "stuck-#{i}.png", "UPLOAD_COMPLETE", false) }
    @iterator.screenshots = complete + stuck
    @sync.on_replace = lambda do |iterator, pass|
      if pass == 2
        iterator.screenshots += stuck.map { |screenshot| Screenshot.new("retry-#{screenshot.id}", screenshot.file_name, "COMPLETE", false) }
      end
    end

    @sync.replace_screenshots(@iterator, Array.new(72))

    assert stuck.all?(&:deleted)
    refute complete.any?(&:deleted)
    assert_equal 72, @iterator.each_app_screenshot.count
    assert_equal 2, @sync.replacement_passes
  end

  def test_checks_the_final_state_before_deleting_at_the_deadline
    @sync.on_sleep = -> { @stuck.state = "COMPLETE" if @sync.elapsed == 300 }

    @sync.replace_screenshots(@iterator, ["1_party.png", "2_balances.png"])

    assert_equal 300, @sync.elapsed
    assert_equal 1, @sync.replacement_passes
    refute @stuck.deleted
  end

  def test_failed_screenshots_enter_the_existing_retry_path_immediately
    @stuck.state = "FAILED"
    @sync.on_replace = lambda do |iterator, pass|
      iterator.screenshots << Screenshot.new("retry", "2_balances.png", "COMPLETE", false) if pass == 2
    end

    @sync.replace_screenshots(@iterator, ["1_party.png", "2_balances.png"])

    assert @stuck.deleted
    refute @complete.deleted
    assert_equal 0, @sync.elapsed
    assert_equal 2, @sync.replacement_passes
  end

  def test_persistently_stuck_screenshots_exhaust_the_retry_limit
    @sync.on_replace = lambda do |iterator, pass|
      iterator.screenshots = [@complete, Screenshot.new("stuck-#{pass}", "2_balances.png", "UPLOAD_COMPLETE", false)]
    end

    assert_raises(FastlaneCore::Interface::FastlaneCrash) do
      @sync.replace_screenshots(@iterator, ["1_party.png", "2_balances.png"], 1)
    end

    assert_equal 2, @sync.replacement_passes
    assert_equal 600, @sync.elapsed
    refute @complete.deleted
  end
end
