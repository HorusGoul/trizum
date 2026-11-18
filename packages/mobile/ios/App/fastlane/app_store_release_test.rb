require "minitest/autorun"
require "fastlane"

Fastlane.load_actions

# Execute the real lane blocks while replacing signing, uploads, and Apple I/O.
class AppStoreReleaseFastfile < Fastlane::FastFile
  attr_reader :events
  attr_accessor :creative_failure, :sleep_hook

  def initialize
    @events = []
    super()
    parse(File.read(File.join(__dir__, "Fastfile")))
  end

  def sleep(seconds)
    @events << [:sleep, seconds]
    sleep_hook&.call
  end

  def method_missing(name, *arguments)
    return super if name == :default_platform
    options = arguments.first || {}
    case name
    when :build_release, :load_api_key
      @events << [name, options]
    when :get_version_number then "1.13.6"
    when :get_build_number then "10130600"
    when :deliver, :upload_to_app_store
      @events << [:deliver, options]
    when :upload_creative_assets
      @events << [name, options]
      raise "Creative processing failed" if creative_failure
    else
      runner.lanes.fetch(:ios).fetch(name).call(options)
    end
  end
end

class AppStoreReleaseTest < Minitest::Test
  Build = Struct.new(:id, :app_version, :version)
  Version = Struct.new(:version_string)
  Submission = Struct.new(:id, :state, :app_store_version_for_review, :events) do
    def cancel_submission
      events << [:cancel_review, id]
    end
  end
  FASTFILE = AppStoreReleaseFastfile.new

  def setup
    @fastfile = FASTFILE
    @fastfile.events.clear
    @fastfile.creative_failure = false
    @fastfile.sleep_hook = nil
    @processing_failure = false
    @build = Build.new("uploaded-build", "1.13.6", "10130600")
    @version = Object.new
    events = @fastfile.events
    @version.define_singleton_method(:select_build) { |**options| events << [:attach, options] }
    @app = Object.new
    @app.define_singleton_method(:id) { "app" }
    version = @version
    @app.define_singleton_method(:get_app_store_versions) do |**options|
      events << [:versions, options]
      [version]
    end
    @active_submissions = []
    active_submissions = @active_submissions
    @app.define_singleton_method(:get_in_progress_review_submission) do |**options|
      events << [:review_lookup, options]
      active_submissions.first
    end
    @app.define_singleton_method(:get_review_submissions) do |**options|
      events << [:review_poll, options]
      active_submissions.dup
    end
  end

  def submit_older_release_for_review
    submission = Submission.new("review-1", "WAITING_FOR_REVIEW", Version.new("1.13.5"), @fastfile.events)
    @active_submissions << submission
    submission
  end

  def with_apple
    original_find = Spaceship::ConnectAPI::App.method(:find)
    original_wait = FastlaneCore::BuildWatcher.method(:wait_for_build_processing_to_be_complete)
    app, build, events, processing_failure = @app, @build, @fastfile.events, @processing_failure
    Spaceship::ConnectAPI::App.define_singleton_method(:find) { |_identifier| app }
    FastlaneCore::BuildWatcher.define_singleton_method(:wait_for_build_processing_to_be_complete) do |**options|
      events << [:wait, options]
      raise "Build processing timed out" if processing_failure
      build
    end
    yield
  ensure
    Spaceship::ConnectAPI::App.define_singleton_method(:find, original_find)
    FastlaneCore::BuildWatcher.define_singleton_method(:wait_for_build_processing_to_be_complete, original_wait)
  end

  def run_lane(name, options = {})
    with_apple { @fastfile.runner.lanes.fetch(:ios).fetch(name).call(options) }
  end

  def submissions
    @fastfile.events.select { |name, options| name == :deliver && options[:submit_for_review] }
  end

  def test_full_release_attaches_the_uploaded_build_before_creatives_and_review
    run_lane(:deploy_appstore_full, automatic_release: true)

    operations = @fastfile.events.map(&:first)
    assert_includes operations, :attach
    assert_operator operations.index(:deliver), :<, operations.index(:wait)
    assert_operator operations.index(:wait), :<, operations.index(:attach)
    assert_operator operations.index(:attach), :<, operations.index(:upload_creative_assets)
    assert_operator operations.index(:upload_creative_assets), :<, operations.rindex(:deliver)
    assert_equal({ build_id: "uploaded-build" }, @fastfile.events.assoc(:attach).last)
    assert_equal({ app_version: "1.13.6" }, @fastfile.events.assoc(:upload_creative_assets).last)
    assert_equal({ platform: "IOS", versionString: "1.13.6" }, @fastfile.events.assoc(:versions).last.fetch(:filter))
    assert_equal 1, @fastfile.events.count { |name, _| name == :wait }
    assert_equal 1, submissions.length
    submission = submissions.first.last
    assert_equal "1.13.6", submission.fetch(:app_version)
    assert_equal "10130600", submission.fetch(:build_number)
    assert submission.fetch(:automatic_release)
    assert submission.fetch(:skip_binary_upload)
    upload = @fastfile.events.assoc(:deliver).last
    refute upload[:submit_for_review]
    refute upload[:skip_binary_upload]
    refute upload.key?(:build_number), "deliver skips IPA upload when build_number is set"
  end

  def test_disabling_review_still_attaches_build_and_creatives
    run_lane(:deploy_appstore_full, submit_for_review: false)

    assert @fastfile.events.assoc(:attach)
    assert @fastfile.events.assoc(:upload_creative_assets)
    assert_empty submissions
  end

  def test_creative_failure_keeps_build_attached_and_stops_review
    @fastfile.creative_failure = true
    assert_raises(RuntimeError) { run_lane(:deploy_appstore_full) }

    assert @fastfile.events.assoc(:attach)
    assert_empty submissions
  end

  def test_submit_review_recovers_existing_release_without_rebuilding_or_uploading_binary
    @build.app_version = "1.13.5"
    @build.version = "10130500"
    run_lane(:submit_review, app_version: "1.13.5", build_number: "10130500")

    wait = @fastfile.events.assoc(:wait).last
    assert_equal "1.13.5", wait.fetch(:app_version)
    assert_equal "10130500", wait.fetch(:build_version)
    assert_equal false, wait.fetch(:select_latest)
    assert_equal Fastlane::FastFile::IOS_BUILD_PROCESSING_TIMEOUT_SECONDS, wait.fetch(:timeout_duration)
    refute @fastfile.events.assoc(:build_release)
    assert @fastfile.events.assoc(:attach)
    assert @fastfile.events.assoc(:upload_creative_assets)
    assert_equal 1, submissions.length
    assert submissions.first.last.fetch(:skip_binary_upload)
    assert_equal "1.13.5", submissions.first.last.fetch(:app_version)
    assert_equal "10130500", submissions.first.last.fetch(:build_number)
    assert_equal({ app_version: "1.13.5" }, @fastfile.events.assoc(:upload_creative_assets).last)
    refute submissions.first.last.fetch(:automatic_release)
  end

  def test_binary_only_release_also_attaches_build
    run_lane(:deploy_appstore)

    assert @fastfile.events.assoc(:attach)
    refute @fastfile.events.assoc(:upload_creative_assets)
    assert_empty submissions
  end

  def test_build_processing_failure_stops_attachment_creatives_and_review
    @processing_failure = true

    assert_raises(RuntimeError) { run_lane(:deploy_appstore_full) }

    refute @fastfile.events.assoc(:attach)
    refute @fastfile.events.assoc(:upload_creative_assets)
    assert_empty submissions
  end

  def test_missing_version_stops_without_attaching_to_another_release
    @app.define_singleton_method(:get_app_store_versions) { |**_options| [] }

    error = assert_raises(FastlaneCore::Interface::FastlaneError) { run_lane(:deploy_appstore_full) }

    assert_match(/Expected one iOS App Store version 1.13.6/, error.message)
    refute @fastfile.events.assoc(:attach)
    refute @fastfile.events.assoc(:upload_creative_assets)
    assert_empty submissions
  end

  def test_full_release_without_review_in_progress_does_not_cancel_anything
    run_lane(:deploy_appstore_full)

    assert @fastfile.events.assoc(:review_lookup)
    refute @fastfile.events.assoc(:cancel_review)
    assert_equal 1, submissions.length
  end

  def test_full_release_cancels_the_in_progress_review_before_updating_the_version
    submit_older_release_for_review
    active_submissions = @active_submissions
    @fastfile.sleep_hook = -> { active_submissions.clear }

    run_lane(:deploy_appstore_full)

    operations = @fastfile.events.map(&:first)
    assert_equal({ platform: "IOS", includes: "appStoreVersionForReview" }, @fastfile.events.assoc(:review_lookup).last)
    assert_equal "review-1", @fastfile.events.assoc(:cancel_review).last
    assert_operator operations.index(:build_release), :<, operations.index(:cancel_review)
    assert_operator operations.index(:cancel_review), :<, operations.index(:deliver)
    assert_operator operations.rindex(:review_poll), :<, operations.index(:deliver)
    assert_equal [:sleep, Fastlane::FastFile::IOS_REVIEW_CANCELLATION_POLL_SECONDS], @fastfile.events.assoc(:sleep)
    poll = @fastfile.events.assoc(:review_poll).last.fetch(:filter)
    assert_equal "IOS", poll.fetch(:platform)
    assert_includes poll.fetch(:state).split(","), "CANCELING"
    assert_equal 1, submissions.length
  end

  def test_full_release_stops_when_review_cancellation_does_not_finish
    submit_older_release_for_review

    error = assert_raises(FastlaneCore::Interface::FastlaneError) { run_lane(:deploy_appstore_full) }

    assert_match(/did not cancel review submission review-1/, error.message)
    expected_sleeps = Fastlane::FastFile::IOS_REVIEW_CANCELLATION_TIMEOUT_SECONDS /
                      Fastlane::FastFile::IOS_REVIEW_CANCELLATION_POLL_SECONDS
    assert_equal expected_sleeps, @fastfile.events.count { |name, _| name == :sleep }
    refute @fastfile.events.assoc(:deliver)
    refute @fastfile.events.assoc(:attach)
  end

  def test_release_without_review_submission_leaves_the_in_progress_review_alone
    submit_older_release_for_review

    error = assert_raises(FastlaneCore::Interface::FastlaneError) do
      run_lane(:deploy_appstore_full, submit_for_review: false)
    end

    assert_match(/iOS 1.13.5 \(review submission review-1, WAITING_FOR_REVIEW\) is already in App Store review/, error.message)
    refute @fastfile.events.assoc(:cancel_review)
    refute @fastfile.events.assoc(:deliver)
  end

  def test_binary_only_release_leaves_the_in_progress_review_alone
    submit_older_release_for_review

    assert_raises(FastlaneCore::Interface::FastlaneError) { run_lane(:deploy_appstore) }

    refute @fastfile.events.assoc(:cancel_review)
    refute @fastfile.events.assoc(:deliver)
  end

  def test_submit_review_replaces_the_in_progress_review_before_attaching_the_build
    submit_older_release_for_review
    active_submissions = @active_submissions
    @fastfile.sleep_hook = -> { active_submissions.clear }

    run_lane(:submit_review, app_version: "1.13.6", build_number: "10130600")

    operations = @fastfile.events.map(&:first)
    assert_operator operations.index(:cancel_review), :<, operations.index(:attach)
    assert_equal 1, submissions.length
  end
end
