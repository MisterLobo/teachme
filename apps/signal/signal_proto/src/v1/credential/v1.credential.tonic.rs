// @generated
/// Generated client implementations.
pub mod credential_service_client {
    #![allow(
        unused_variables,
        dead_code,
        missing_docs,
        clippy::wildcard_imports,
        clippy::let_unit_value,
    )]
    use tonic::codegen::*;
    use tonic::codegen::http::Uri;
    #[derive(Debug, Clone)]
    pub struct CredentialServiceClient<T> {
        inner: tonic::client::Grpc<T>,
    }
    impl CredentialServiceClient<tonic::transport::Channel> {
        /// Attempt to create a new client by connecting to a given endpoint.
        pub async fn connect<D>(dst: D) -> Result<Self, tonic::transport::Error>
        where
            D: TryInto<tonic::transport::Endpoint>,
            D::Error: Into<StdError>,
        {
            let conn = tonic::transport::Endpoint::new(dst)?.connect().await?;
            Ok(Self::new(conn))
        }
    }
    impl<T> CredentialServiceClient<T>
    where
        T: tonic::client::GrpcService<tonic::body::Body>,
        T::Error: Into<StdError>,
        T::ResponseBody: Body<Data = Bytes> + std::marker::Send + 'static,
        <T::ResponseBody as Body>::Error: Into<StdError> + std::marker::Send,
    {
        pub fn new(inner: T) -> Self {
            let inner = tonic::client::Grpc::new(inner);
            Self { inner }
        }
        pub fn with_origin(inner: T, origin: Uri) -> Self {
            let inner = tonic::client::Grpc::with_origin(inner, origin);
            Self { inner }
        }
        pub fn with_interceptor<F>(
            inner: T,
            interceptor: F,
        ) -> CredentialServiceClient<InterceptedService<T, F>>
        where
            F: tonic::service::Interceptor,
            T::ResponseBody: Default,
            T: tonic::codegen::Service<
                http::Request<tonic::body::Body>,
                Response = http::Response<
                    <T as tonic::client::GrpcService<tonic::body::Body>>::ResponseBody,
                >,
            >,
            <T as tonic::codegen::Service<
                http::Request<tonic::body::Body>,
            >>::Error: Into<StdError> + std::marker::Send + std::marker::Sync,
        {
            CredentialServiceClient::new(InterceptedService::new(inner, interceptor))
        }
        /// Compress requests with the given encoding.
        ///
        /// This requires the server to support it otherwise it might respond with an
        /// error.
        #[must_use]
        pub fn send_compressed(mut self, encoding: CompressionEncoding) -> Self {
            self.inner = self.inner.send_compressed(encoding);
            self
        }
        /// Enable decompressing responses.
        #[must_use]
        pub fn accept_compressed(mut self, encoding: CompressionEncoding) -> Self {
            self.inner = self.inner.accept_compressed(encoding);
            self
        }
        /// Limits the maximum size of a decoded message.
        ///
        /// Default: `4MB`
        #[must_use]
        pub fn max_decoding_message_size(mut self, limit: usize) -> Self {
            self.inner = self.inner.max_decoding_message_size(limit);
            self
        }
        /// Limits the maximum size of an encoded message.
        ///
        /// Default: `usize::MAX`
        #[must_use]
        pub fn max_encoding_message_size(mut self, limit: usize) -> Self {
            self.inner = self.inner.max_encoding_message_size(limit);
            self
        }
        pub async fn store_device(
            &mut self,
            request: impl tonic::IntoRequest<super::CredentialStoreDeviceParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/StoreDevice",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new("v1.credential.CredentialService", "StoreDevice"),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn retrieve_device(
            &mut self,
            request: impl tonic::IntoRequest<super::CredentialRetrieveDeviceParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/RetrieveDevice",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new("v1.credential.CredentialService", "RetrieveDevice"),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn list_devices(
            &mut self,
            request: impl tonic::IntoRequest<super::CredentialListDevicesParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/ListDevices",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new("v1.credential.CredentialService", "ListDevices"),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn store_keys(
            &mut self,
            request: impl tonic::IntoRequest<super::CredentialStoreKeysParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/StoreKeys",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(GrpcMethod::new("v1.credential.CredentialService", "StoreKeys"));
            self.inner.unary(req, path, codec).await
        }
        pub async fn save_key(
            &mut self,
            request: impl tonic::IntoRequest<super::CredentialStoreKeysParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/SaveKey",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(GrpcMethod::new("v1.credential.CredentialService", "SaveKey"));
            self.inner.unary(req, path, codec).await
        }
        pub async fn retrieve_keys(
            &mut self,
            request: impl tonic::IntoRequest<super::CredentialRetrieveKeysParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/RetrieveKeys",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new("v1.credential.CredentialService", "RetrieveKeys"),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn register_begin(
            &mut self,
            request: impl tonic::IntoRequest<()>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialRegisterBeginResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/RegisterBegin",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new("v1.credential.CredentialService", "RegisterBegin"),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn register_finish(
            &mut self,
            request: impl tonic::IntoRequest<super::CredentialRegisterFinishRequest>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialRegisterFinishResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/RegisterFinish",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new("v1.credential.CredentialService", "RegisterFinish"),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn login_begin(
            &mut self,
            request: impl tonic::IntoRequest<super::CredentialLoginBeginRequest>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialLoginBeginResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/LoginBegin",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new("v1.credential.CredentialService", "LoginBegin"),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn login_finish(
            &mut self,
            request: impl tonic::IntoRequest<super::CredentialLoginFinishRequest>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialLoginFinishResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/LoginFinish",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new("v1.credential.CredentialService", "LoginFinish"),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn opaque_register_begin(
            &mut self,
            request: impl tonic::IntoRequest<super::OpaqueRegisterBeginRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueRegisterBeginResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/OpaqueRegisterBegin",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new(
                        "v1.credential.CredentialService",
                        "OpaqueRegisterBegin",
                    ),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn opaque_register_finish(
            &mut self,
            request: impl tonic::IntoRequest<super::OpaqueRegisterFinishRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueRegisterFinishResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/OpaqueRegisterFinish",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new(
                        "v1.credential.CredentialService",
                        "OpaqueRegisterFinish",
                    ),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn opaque_login_begin(
            &mut self,
            request: impl tonic::IntoRequest<super::OpaqueLoginBeginRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueLoginBeginResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/OpaqueLoginBegin",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new(
                        "v1.credential.CredentialService",
                        "OpaqueLoginBegin",
                    ),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn opaque_login_finish(
            &mut self,
            request: impl tonic::IntoRequest<super::OpaqueLoginFinishRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueLoginFinishResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/OpaqueLoginFinish",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new(
                        "v1.credential.CredentialService",
                        "OpaqueLoginFinish",
                    ),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn opaque_batch_register_begin(
            &mut self,
            request: impl tonic::IntoRequest<super::OpaqueBatchRegisterBeginRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueBatchRegisterBeginRespose>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/OpaqueBatchRegisterBegin",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new(
                        "v1.credential.CredentialService",
                        "OpaqueBatchRegisterBegin",
                    ),
                );
            self.inner.unary(req, path, codec).await
        }
        pub async fn opaque_batch_register_finish(
            &mut self,
            request: impl tonic::IntoRequest<super::OpaqueBatchRegisterFinishRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueBatchRegisterFinishResponse>,
            tonic::Status,
        > {
            self.inner
                .ready()
                .await
                .map_err(|e| {
                    tonic::Status::unknown(
                        format!("Service was not ready: {}", e.into()),
                    )
                })?;
            let codec = tonic_prost::ProstCodec::default();
            let path = http::uri::PathAndQuery::from_static(
                "/v1.credential.CredentialService/OpaqueBatchRegisterFinish",
            );
            let mut req = request.into_request();
            req.extensions_mut()
                .insert(
                    GrpcMethod::new(
                        "v1.credential.CredentialService",
                        "OpaqueBatchRegisterFinish",
                    ),
                );
            self.inner.unary(req, path, codec).await
        }
    }
}
/// Generated server implementations.
pub mod credential_service_server {
    #![allow(
        unused_variables,
        dead_code,
        missing_docs,
        clippy::wildcard_imports,
        clippy::let_unit_value,
    )]
    use tonic::codegen::*;
    /// Generated trait containing gRPC methods that should be implemented for use with CredentialServiceServer.
    #[async_trait]
    pub trait CredentialService: std::marker::Send + std::marker::Sync + 'static {
        async fn store_device(
            &self,
            request: tonic::Request<super::CredentialStoreDeviceParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        >;
        async fn retrieve_device(
            &self,
            request: tonic::Request<super::CredentialRetrieveDeviceParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        >;
        async fn list_devices(
            &self,
            request: tonic::Request<super::CredentialListDevicesParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        >;
        async fn store_keys(
            &self,
            request: tonic::Request<super::CredentialStoreKeysParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        >;
        async fn save_key(
            &self,
            request: tonic::Request<super::CredentialStoreKeysParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        >;
        async fn retrieve_keys(
            &self,
            request: tonic::Request<super::CredentialRetrieveKeysParams>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialResponse>,
            tonic::Status,
        >;
        async fn register_begin(
            &self,
            request: tonic::Request<()>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialRegisterBeginResponse>,
            tonic::Status,
        >;
        async fn register_finish(
            &self,
            request: tonic::Request<super::CredentialRegisterFinishRequest>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialRegisterFinishResponse>,
            tonic::Status,
        >;
        async fn login_begin(
            &self,
            request: tonic::Request<super::CredentialLoginBeginRequest>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialLoginBeginResponse>,
            tonic::Status,
        >;
        async fn login_finish(
            &self,
            request: tonic::Request<super::CredentialLoginFinishRequest>,
        ) -> std::result::Result<
            tonic::Response<super::CredentialLoginFinishResponse>,
            tonic::Status,
        >;
        async fn opaque_register_begin(
            &self,
            request: tonic::Request<super::OpaqueRegisterBeginRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueRegisterBeginResponse>,
            tonic::Status,
        >;
        async fn opaque_register_finish(
            &self,
            request: tonic::Request<super::OpaqueRegisterFinishRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueRegisterFinishResponse>,
            tonic::Status,
        >;
        async fn opaque_login_begin(
            &self,
            request: tonic::Request<super::OpaqueLoginBeginRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueLoginBeginResponse>,
            tonic::Status,
        >;
        async fn opaque_login_finish(
            &self,
            request: tonic::Request<super::OpaqueLoginFinishRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueLoginFinishResponse>,
            tonic::Status,
        >;
        async fn opaque_batch_register_begin(
            &self,
            request: tonic::Request<super::OpaqueBatchRegisterBeginRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueBatchRegisterBeginRespose>,
            tonic::Status,
        >;
        async fn opaque_batch_register_finish(
            &self,
            request: tonic::Request<super::OpaqueBatchRegisterFinishRequest>,
        ) -> std::result::Result<
            tonic::Response<super::OpaqueBatchRegisterFinishResponse>,
            tonic::Status,
        >;
    }
    #[derive(Debug)]
    pub struct CredentialServiceServer<T> {
        inner: Arc<T>,
        accept_compression_encodings: EnabledCompressionEncodings,
        send_compression_encodings: EnabledCompressionEncodings,
        max_decoding_message_size: Option<usize>,
        max_encoding_message_size: Option<usize>,
    }
    impl<T> CredentialServiceServer<T> {
        pub fn new(inner: T) -> Self {
            Self::from_arc(Arc::new(inner))
        }
        pub fn from_arc(inner: Arc<T>) -> Self {
            Self {
                inner,
                accept_compression_encodings: Default::default(),
                send_compression_encodings: Default::default(),
                max_decoding_message_size: None,
                max_encoding_message_size: None,
            }
        }
        pub fn with_interceptor<F>(
            inner: T,
            interceptor: F,
        ) -> InterceptedService<Self, F>
        where
            F: tonic::service::Interceptor,
        {
            InterceptedService::new(Self::new(inner), interceptor)
        }
        /// Enable decompressing requests with the given encoding.
        #[must_use]
        pub fn accept_compressed(mut self, encoding: CompressionEncoding) -> Self {
            self.accept_compression_encodings.enable(encoding);
            self
        }
        /// Compress responses with the given encoding, if the client supports it.
        #[must_use]
        pub fn send_compressed(mut self, encoding: CompressionEncoding) -> Self {
            self.send_compression_encodings.enable(encoding);
            self
        }
        /// Limits the maximum size of a decoded message.
        ///
        /// Default: `4MB`
        #[must_use]
        pub fn max_decoding_message_size(mut self, limit: usize) -> Self {
            self.max_decoding_message_size = Some(limit);
            self
        }
        /// Limits the maximum size of an encoded message.
        ///
        /// Default: `usize::MAX`
        #[must_use]
        pub fn max_encoding_message_size(mut self, limit: usize) -> Self {
            self.max_encoding_message_size = Some(limit);
            self
        }
    }
    impl<T, B> tonic::codegen::Service<http::Request<B>> for CredentialServiceServer<T>
    where
        T: CredentialService,
        B: Body + std::marker::Send + 'static,
        B::Error: Into<StdError> + std::marker::Send + 'static,
    {
        type Response = http::Response<tonic::body::Body>;
        type Error = std::convert::Infallible;
        type Future = BoxFuture<Self::Response, Self::Error>;
        fn poll_ready(
            &mut self,
            _cx: &mut Context<'_>,
        ) -> Poll<std::result::Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }
        fn call(&mut self, req: http::Request<B>) -> Self::Future {
            match req.uri().path() {
                "/v1.credential.CredentialService/StoreDevice" => {
                    #[allow(non_camel_case_types)]
                    struct StoreDeviceSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::CredentialStoreDeviceParams>
                    for StoreDeviceSvc<T> {
                        type Response = super::CredentialResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::CredentialStoreDeviceParams>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::store_device(&inner, request)
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = StoreDeviceSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/RetrieveDevice" => {
                    #[allow(non_camel_case_types)]
                    struct RetrieveDeviceSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::CredentialRetrieveDeviceParams>
                    for RetrieveDeviceSvc<T> {
                        type Response = super::CredentialResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<
                                super::CredentialRetrieveDeviceParams,
                            >,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::retrieve_device(&inner, request)
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = RetrieveDeviceSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/ListDevices" => {
                    #[allow(non_camel_case_types)]
                    struct ListDevicesSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::CredentialListDevicesParams>
                    for ListDevicesSvc<T> {
                        type Response = super::CredentialResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::CredentialListDevicesParams>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::list_devices(&inner, request)
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = ListDevicesSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/StoreKeys" => {
                    #[allow(non_camel_case_types)]
                    struct StoreKeysSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::CredentialStoreKeysParams>
                    for StoreKeysSvc<T> {
                        type Response = super::CredentialResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::CredentialStoreKeysParams>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::store_keys(&inner, request).await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = StoreKeysSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/SaveKey" => {
                    #[allow(non_camel_case_types)]
                    struct SaveKeySvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::CredentialStoreKeysParams>
                    for SaveKeySvc<T> {
                        type Response = super::CredentialResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::CredentialStoreKeysParams>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::save_key(&inner, request).await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = SaveKeySvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/RetrieveKeys" => {
                    #[allow(non_camel_case_types)]
                    struct RetrieveKeysSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::CredentialRetrieveKeysParams>
                    for RetrieveKeysSvc<T> {
                        type Response = super::CredentialResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::CredentialRetrieveKeysParams>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::retrieve_keys(&inner, request)
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = RetrieveKeysSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/RegisterBegin" => {
                    #[allow(non_camel_case_types)]
                    struct RegisterBeginSvc<T: CredentialService>(pub Arc<T>);
                    impl<T: CredentialService> tonic::server::UnaryService<()>
                    for RegisterBeginSvc<T> {
                        type Response = super::CredentialRegisterBeginResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(&mut self, request: tonic::Request<()>) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::register_begin(&inner, request)
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = RegisterBeginSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/RegisterFinish" => {
                    #[allow(non_camel_case_types)]
                    struct RegisterFinishSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::CredentialRegisterFinishRequest>
                    for RegisterFinishSvc<T> {
                        type Response = super::CredentialRegisterFinishResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<
                                super::CredentialRegisterFinishRequest,
                            >,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::register_finish(&inner, request)
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = RegisterFinishSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/LoginBegin" => {
                    #[allow(non_camel_case_types)]
                    struct LoginBeginSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::CredentialLoginBeginRequest>
                    for LoginBeginSvc<T> {
                        type Response = super::CredentialLoginBeginResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::CredentialLoginBeginRequest>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::login_begin(&inner, request).await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = LoginBeginSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/LoginFinish" => {
                    #[allow(non_camel_case_types)]
                    struct LoginFinishSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::CredentialLoginFinishRequest>
                    for LoginFinishSvc<T> {
                        type Response = super::CredentialLoginFinishResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::CredentialLoginFinishRequest>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::login_finish(&inner, request)
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = LoginFinishSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/OpaqueRegisterBegin" => {
                    #[allow(non_camel_case_types)]
                    struct OpaqueRegisterBeginSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::OpaqueRegisterBeginRequest>
                    for OpaqueRegisterBeginSvc<T> {
                        type Response = super::OpaqueRegisterBeginResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::OpaqueRegisterBeginRequest>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::opaque_register_begin(
                                        &inner,
                                        request,
                                    )
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = OpaqueRegisterBeginSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/OpaqueRegisterFinish" => {
                    #[allow(non_camel_case_types)]
                    struct OpaqueRegisterFinishSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::OpaqueRegisterFinishRequest>
                    for OpaqueRegisterFinishSvc<T> {
                        type Response = super::OpaqueRegisterFinishResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::OpaqueRegisterFinishRequest>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::opaque_register_finish(
                                        &inner,
                                        request,
                                    )
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = OpaqueRegisterFinishSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/OpaqueLoginBegin" => {
                    #[allow(non_camel_case_types)]
                    struct OpaqueLoginBeginSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::OpaqueLoginBeginRequest>
                    for OpaqueLoginBeginSvc<T> {
                        type Response = super::OpaqueLoginBeginResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::OpaqueLoginBeginRequest>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::opaque_login_begin(
                                        &inner,
                                        request,
                                    )
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = OpaqueLoginBeginSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/OpaqueLoginFinish" => {
                    #[allow(non_camel_case_types)]
                    struct OpaqueLoginFinishSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::OpaqueLoginFinishRequest>
                    for OpaqueLoginFinishSvc<T> {
                        type Response = super::OpaqueLoginFinishResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<super::OpaqueLoginFinishRequest>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::opaque_login_finish(
                                        &inner,
                                        request,
                                    )
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = OpaqueLoginFinishSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/OpaqueBatchRegisterBegin" => {
                    #[allow(non_camel_case_types)]
                    struct OpaqueBatchRegisterBeginSvc<T: CredentialService>(pub Arc<T>);
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<super::OpaqueBatchRegisterBeginRequest>
                    for OpaqueBatchRegisterBeginSvc<T> {
                        type Response = super::OpaqueBatchRegisterBeginRespose;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<
                                super::OpaqueBatchRegisterBeginRequest,
                            >,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::opaque_batch_register_begin(
                                        &inner,
                                        request,
                                    )
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = OpaqueBatchRegisterBeginSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                "/v1.credential.CredentialService/OpaqueBatchRegisterFinish" => {
                    #[allow(non_camel_case_types)]
                    struct OpaqueBatchRegisterFinishSvc<T: CredentialService>(
                        pub Arc<T>,
                    );
                    impl<
                        T: CredentialService,
                    > tonic::server::UnaryService<
                        super::OpaqueBatchRegisterFinishRequest,
                    > for OpaqueBatchRegisterFinishSvc<T> {
                        type Response = super::OpaqueBatchRegisterFinishResponse;
                        type Future = BoxFuture<
                            tonic::Response<Self::Response>,
                            tonic::Status,
                        >;
                        fn call(
                            &mut self,
                            request: tonic::Request<
                                super::OpaqueBatchRegisterFinishRequest,
                            >,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            let fut = async move {
                                <T as CredentialService>::opaque_batch_register_finish(
                                        &inner,
                                        request,
                                    )
                                    .await
                            };
                            Box::pin(fut)
                        }
                    }
                    let accept_compression_encodings = self.accept_compression_encodings;
                    let send_compression_encodings = self.send_compression_encodings;
                    let max_decoding_message_size = self.max_decoding_message_size;
                    let max_encoding_message_size = self.max_encoding_message_size;
                    let inner = self.inner.clone();
                    let fut = async move {
                        let method = OpaqueBatchRegisterFinishSvc(inner);
                        let codec = tonic_prost::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        let res = grpc.unary(method, req).await;
                        Ok(res)
                    };
                    Box::pin(fut)
                }
                _ => {
                    Box::pin(async move {
                        let mut response = http::Response::new(
                            tonic::body::Body::default(),
                        );
                        let headers = response.headers_mut();
                        headers
                            .insert(
                                tonic::Status::GRPC_STATUS,
                                (tonic::Code::Unimplemented as i32).into(),
                            );
                        headers
                            .insert(
                                http::header::CONTENT_TYPE,
                                tonic::metadata::GRPC_CONTENT_TYPE,
                            );
                        Ok(response)
                    })
                }
            }
        }
    }
    impl<T> Clone for CredentialServiceServer<T> {
        fn clone(&self) -> Self {
            let inner = self.inner.clone();
            Self {
                inner,
                accept_compression_encodings: self.accept_compression_encodings,
                send_compression_encodings: self.send_compression_encodings,
                max_decoding_message_size: self.max_decoding_message_size,
                max_encoding_message_size: self.max_encoding_message_size,
            }
        }
    }
    /// Generated gRPC service name
    pub const SERVICE_NAME: &str = "v1.credential.CredentialService";
    impl<T> tonic::server::NamedService for CredentialServiceServer<T> {
        const NAME: &'static str = SERVICE_NAME;
    }
}
