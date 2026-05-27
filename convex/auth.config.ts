const authConfig = {
  providers: [
    {
      // The issuer domain from your Clerk application dashboard
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
