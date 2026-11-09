require "spaceship/connect_api"

# Asset reservations and placement creation have no idempotency key. Spaceship
# retries both above and below request(), so constrain both layers for POST.
class CreativeAssetsAPIClient < Spaceship::ConnectAPI::Tunes::Client
  def post(url_or_path, body, tries: 1)
    previous = @single_attempt_post
    @single_attempt_post = true
    super(url_or_path, body, tries: tries)
  ensure
    @single_attempt_post = previous
  end

  protected

  def with_asc_retry(tries = 5, backoff = 1, &block)
    return yield if @single_attempt_post
    super
  end

  def with_retry(tries = 5, &block)
    super(@single_attempt_post ? 1 : tries, &block)
  end
end
