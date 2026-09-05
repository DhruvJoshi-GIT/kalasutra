"""All ORM models, imported so Base.metadata knows every table."""
from app.models.user import Role, User, Address, PaymentType, PaymentMethod  # noqa: F401
from app.models.artisan import KycStatus, ArtisanProfile, OtpChallenge  # noqa: F401
from app.models.catalogue import (  # noqa: F401
    Category, Product, ProductImage, AiStatus, EnhanceStatus,
)
from app.models.commerce import (  # noqa: F401
    Cart, CartItem, WishlistItem, Order, OrderItem, OrderStatus, PaymentStatus,
)
from app.models.social import Review, ProductComment, Enquiry, EnquiryStatus  # noqa: F401
from app.models.ai import (  # noqa: F401
    VoiceNote, PriceSuggestion, AiCache, Job, JobKind, JobStatus,
)
from app.models.files import StoredFile  # noqa: F401
